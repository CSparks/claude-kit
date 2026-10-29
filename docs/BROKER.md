# Build broker — a single-checkout patch queue

KIT-T270 built it; KIT-T276 reworked it (design: `docs/design/broker-patch-queue.md`).
ONE Node daemon per checkout is the only writer: it applies queued patches, runs the gates,
builds and tests with the checkout's shared `CARGO_TARGET_DIR`, and lands green patches on
`main` by explicit paths. Any number of read-only `patch-worker` agents read the tree and
queue patches; none writes or builds. No worktrees, no lane branches. The daemon costs no
tokens; stuck patches escalate to the orchestrator.

Worker workflow: the `patch-worker` skill. This page is for the OPERATOR.

Any agent can be a worker, Claude or not (Codex, GPT): the whole interface is two shell commands,
`submit.mjs` (the envelope on stdin) and `wait.mjs`, with the envelope format in the skill. An agent
that edits the tree by hand instead pauses the lane's queue until its edits are committed or reverted
(pre-write names the daemon and the queue length at the first edit); point such an agent at the skill
rather than giving it a second write path.

## The pieces (`scripts/broker/`)

- `broker.mjs` — the daemon; also `pause` / `resume`, and `clean <path...> | --pycache` (removes untracked
  leftovers such as a stray `__pycache__`; tracked files are refused, a patch deletes those).
- `submit.mjs` — a worker pipes a patch envelope on stdin; prints the job id.
- `wait.mjs` — blocks on a result (default 100 s, under the 120 s a foreground Bash call survives; `--timeout`
  up to 540 with the Bash timeout at 600000), exits with the status, prints the queue position on timeout (exit 2:
  the job is still running, wait again).
- by concern: `envelope` (parse) · `apply` (in-memory dry run) · `admit` (dirty/plan/gate checks) · `patch` (one job) · `train*` (several jobs, one build) · `gate`
  (pre-write hook) · `land` (path commit, push, pin) · `preimage` (restore journal) ·
  `diagnose` (rustc / test extraction) · `report` · `summary` (orient lines) · `control` ·
  `config` · `git` · `glob` · `run` · `result` · `submodule` · `queue` · `lock`.

## Running it

```
# background Bash from the orchestrator; a second start while one is live exits 1
node <kit>/scripts/broker/broker.mjs --root <checkout> [--idle-exit 30]

node <kit>/scripts/broker/broker.mjs pause  --root <checkout>   # stop starting jobs
node <kit>/scripts/broker/broker.mjs resume --root <checkout>
node <kit>/scripts/broker/broker.mjs --root <checkout> --once   # drain once and exit
```

`--idle-exit <min>` exits after that many idle minutes (empty queue, not paused). The lock
(`target/broker/broker.lock`) is reclaimed when its pid is dead, so a restart is idempotent;
a crash mid-job leaves the job queued and the restart restores the tree first.

Orient lists the daemon state, the patch in flight (`target/broker/inflight.json`) and the
landings since the last look.

## Phases per patch

Stop at the first failure; each writes `target/broker/results/<id>.json`.

1. `submit-dryrun` — `submit.mjs` applies every op in memory to `git show HEAD:<path>`. A miss
   returns `stale` in seconds and never queues.
2. `apply` — the daemon re-runs the dry run against current `HEAD`. An `edit` applies while its
   SEARCH text matches exactly once, so intervening commits do not matter unless they touched
   that text. Misses are `not-found`, `ambiguous xN`, `create-exists` (a `write` onto an
   existing tracked or untracked path), each with the closest excerpt and
   `git log base..HEAD -- <path>`.
3. `gate` — `hooks/pre-write.mjs` runs per surviving file on a synthesized Write payload
   (file length, comments, magic numbers, forbidden paths). Failure → `gate`, tree untouched.
4. `run` — pre-images go to the object database and `inflight.json`; the files are written;
   the commands run (`-j <jobs>`, `--no-fail-fast` for `cargo test`/`cargo t`; the `t`/`b`/`r`
   aliases compose too). A check-only patch restores byte for byte afterwards.

   **Failure attribution** (`attribute.mjs`): a command that fails with named failed tests and
   no rustc error is re-run on the pre-patch tree (the journal restores it; untouched dirty
   files stay as they are), filtered to those tests (nextest `-E "test(=a) or test(=b)"`, else
   libtest `-- --exact a b`), then the patch is re-applied. A test that also fails without the
   patch is foreign: the job passes when every failure is foreign, and `foreign: [{test,
   reason}]` is recorded and printed. A test that passes without the patch fails the job; a
   build error is never attributed.

   **Deferred** (`deferred.mjs`): each foreign test is also written to
   `target/broker/deferred.json` (test, command, repo, job, reason, dirty paths). While idle the
   daemon re-runs just those tests when HEAD moves or a recorded dirty path turns clean: a pass
   drops the entry; a failure with none of its recorded paths dirty is a real break, filed with
   `cap bug` in the repo and dropped. `broker status` and the orient banner list them.

   **Baseline cache** (`baseline.mjs`): a base run is keyed by the pre-patch tree state, the
   held pins and the command; a repeat (a worker's next red revision on the same HEAD) reuses the
   base log without restoring or rebuilding.

5. `land` — with `--land` and green: `git add` + `git commit -- <paths>` (never `-a`/`-A`),
   message `<title> (implements <ticket>)` with a `Broker-Gate: <job> N/N commands green …`
   body that the ticket evidence floor (KIT-T061) cites, push `main`. `--land` needs `--ticket`.

## Fast landing (KIT-T472)

- **Green cache** (`green.mjs`): a passed check-only run is keyed by HEAD, the tracked edits in
  the tree, the patch's files, its pins and its commands. A `--land` with the same key lands on
  that evidence (`reusedFrom` in the result) without building or testing again.
- **Affected gate** (`land_gate: affected`; `affected.mjs`, `landgate.mjs`): a landing runs
  `affected.check` (default `cargo check --workspace --all-targets`) plus `affected.test -p <crate>`
  over the targets its changed paths map to (`tests/x.rs` → `--test x`; a `src` module →
  `--lib` + the tests naming it; a shared test module or asset → the tests naming it;
  `src/bin/b.rs` → `--bin b`), plus the worker's targeted commands. Suite-shaped commands (a
  `suite` entry modulo `-j`/`--no-fail-fast`, or an unfiltered `cargo test`) leave the gate. A
  `.rs`/`Cargo.toml` outside every crate falls back to the job's commands. The result carries
  `selection: { reasons, dropped }`. A job that carries its own `--test` commands runs those in place of the mapped tests, after the
  all-targets `affected.check` (KIT-T677, also when the landing reuses a green check-only run: the check then runs alone on top of the reused commands; a narrow `--test` list cannot land a break in a target it does not build; suite-shaped ones still leave); `affected.mandatory: true` runs the mapped set regardless. A crate
  of a nested workspace (a submodule's `rust/`, seen from the superproject or from its lane) is tested
  as `cd <workspace dir> && affected.test -p <crate> …`. `affected.match: module` ties a src module
  to the tests that reach it by path (`parent::mod`, `parent::{…, mod}`, `mod::`) instead of any test
  naming the word (`affected-match.mjs`; dirt-empire HUD patch: 53 specs → 26).
- **Suite cadence** (`suite.mjs`): while the queue is idle and `suite_every` landings have
  accumulated, the daemon runs `suite` (default `verify_default`) on the committed HEAD; a
  queued job cancels it (it re-runs later), a hand-edited build path skips it. The tree is never
  checked out or rewritten. A red run writes `suite/<sha>.json` and files one `cap regression`
  per failing set: the range since the last green run, the failing tests with their targets,
  and the landings whose paths map to those targets as the inferred causing_commit
  (`suite-blame.mjs`). `broker status` prints the suite line.
- **-j auto** (`jobs.mjs`): every core the RAM feeds at 4 GiB a job, unless a number pins it.
- **Machine build slots** (KIT-T622, `build-slot.mjs`): every cargo build-shaped command and every pre-push gate takes a slot first, in arrival order, shared by all brokers on the box through `~/.claude/claude-kit-build-slots` (`CLAUDE_KIT_BUILD_SLOT_DIR` moves it). The box has `floor(auto jobs / this job's -j)` slots, one where `-j` already fills it. Brokers of different checkouts used to multiply `-j`: a dirt-empire link wave took 167-221 s beside a stiletto build and 10-20 s alone, and a gate hook aborted at a 7 MB heap when the pagefile ran out. A result's command carries `slotWaitMs`; an over-ceiling report names the queued minutes. A slot or ticket whose process died is reclaimed.
- **Suite never holds a landing** (KIT-T504): the suite runs only while the queue is empty and a queued job cancels it within one poll. Commands it finished stay recorded per sha (`state.partial`) and are not re-run while HEAD is unchanged; a landing moves HEAD, so the next run starts over. Under constant load the suite waits; `broker status` shows the last green sha.
- **runner: nextest** (`coalesce.mjs`): a job's or a train's per-target `cargo test`/`cargo t` commands (no `--` filters) run as one `cargo nextest run --no-fail-fast -p a -p b <selectors>` across every package they name: one build, test binaries in parallel. cargo applies a selector to each package that has the target, so a package may run a few extra targets, never fewer; a workspace-wide command keeps its own run. The result entry lists them under `coalesced`.
- **Suite partitions** (`suite-shard.mjs`, KIT-T482): with `suite_partitions: N` each suite run covers one rotating partition (`cargo nextest run … --partition count:k/N`; other suite commands take turns), so a forced run holds the writer for 1/N of the suite.
- **Push gate** (`prepush.mjs`, KIT-T482 item 3): every `git push` and build the broker runs gets the shared `CARGO_TARGET_DIR` and `CARGO_BUILD_JOBS`. A repo entry with `pre_push: true` has the daemon run the repo's own pre-push hook (`git hook run pre-push`) on the landing commit before `git push`; a gate that stamps its green run (rapid-game's rg-gate-green.json) then passes the push at once, so a long gate never outlives git's connection (exit 141). A refused or failed push leaves no local commit: before a rebase the commit is undone and the files restored, after one HEAD returns to the remote tip.
- **Health faults** carry the runtime and daemon pid they happened under; a gate crash is resolved once a later job's gate answers.
- **Batch trains** (KIT-T482 item 1; `train-form.mjs`, `train.mjs`, `train-commands.mjs`, `train-run.mjs`, `train-blame.mjs`, `train-land.mjs`): the head of the queue takes along up to `batch` (default 8; 1 = off) later jobs of its repo that carry operations, hold no `--pin`, pass admission (`admit.mjs`) and touch no path another member, or an earlier skipped job, touches (a Cargo.toml/Cargo.lock edit rides like any file, KIT-T684: its path is claimed, so two jobs over one manifest never share a train, and the Cargo.lock the build rewrites lands in the commit of the member that edited a manifest, else the first). All their files go on the tree under one journal, the union of their commands runs once (owners kept per command; `runner: nextest` merges every package's targets into one run). Green: check-only members pass and are restored, landing members commit by their own paths in submit order and leave in ONE push (`landCommits`); a submodule train pins its superproject once, naming every ticket. Red: foreign tests are attributed against the pre-train tree as for a solo job; the rest is traced to one member (`train-blame.mjs`: a compile error to the member that touched the file; a test to the only member running its command, else selecting its target, else touching its test file or module). Blamed members fail at once with `blame` and the rest rebuild without them; a red nobody can be blamed for splits the group in halves, first half first, each half on the HEAD the earlier one landed. Results carry `train: { id, members, size, builds }`; the landing trailer names the train. A job alone in the queue takes the solo path unchanged. Vetting run on real cargo: `node scripts/broker/acceptance/train.mjs` (serial vs trains, invariants PASS/FAIL; `--crates` for a crate per patch, which also checks one test invocation across the packages).
- **Known red** (KIT-T482 item 5, `known-red.mjs`): a command that fails only on compile errors in files no patch touched runs once on the pre-patch tree; errors there too are foreign and go into the known-red list for the tree state (cache `known-red`), so later jobs on that state skip the baseline. After a landing the last list carries over while its HEAD is an ancestor, the files are unchanged and the error text is identical. The command then re-runs without the broken targets (`--keep-going` for check/build/clippy, a broken `--test`/`--bin` dropped from a test command); a rerun whose only errors are known red is green for the patch, and the entry carries `knownRed: { files, rerun, clean, note }`. A library file cannot be left out of a test command, so such a red stays red with the note. Solo jobs and trains share it.
- **Sessions in turn** (KIT-T482 item 8, `rr.mjs`): a job carries the submitting `session` (`--session`, else the harness session id). The queue serves sessions in turn, each session's jobs in submit order, and a job never passes an older job of another session over one of its paths; the turn carries across drains (`rr.json`).
- **Incremental caches** (KIT-T483/T500, `incremental.mjs`): after every suite run (nothing building) the daemon drops each incremental unit (full `<crate>-<hash>` name, so lib, test harness and check units are kept apart) unused for `incremental_keep_hours` (default 24; `off` disables), never one written in the last 15 minutes, and sessions a killed build left `-working`. A delete renames the unit to a `.trash-` name first; a failed delete leaves only that name, swept by the next prune. The suite line in the daemon log reports before/after. `node scripts/broker/incremental.mjs --root <checkout> [--keep-hours N] [--dry-run]` runs it by hand.
- **Link-failure retry** (KIT-T500, `link-recover.mjs`): a daemon-run command whose log shows `linking with � failed` and `undefined symbol: anon.*.llvm` (a stale incremental cache) has the incremental units of the crate named in `could not compile` cleared (all crates if unnamed) and runs once more. The log gets a `[broker] link failure �` line and the result `recovered`.
- **Hand-built full suites** (KIT-T500, `landgate.mjs`): under `land_gate: affected` a `cargo test` command naming 8 or more `--test` targets counts as suite-shaped like an unfiltered `cargo test`: it leaves the landing gate (listed in `selection.dropped`) and the suite cadence covers it on committed HEAD. Workers should not enumerate every test target.
- **Queue stats** (`stats.mjs`): `node scripts/broker/stats.mjs --root <checkout> [--split <ISO time>]` reads the result files: jobs, builds, trains, waiting split into behind-a-running-job and no-job-running, median and p90 wait, median run and first-command time, before/after a moment.
- **Watchdog and landings** (KIT-T493, KIT-T496): the daemon beats in every phase: commands, and the landing's git calls (commit, the repo's pre-push gate, push, the pin commit and push) run beside a pulse (`run-pulsing.mjs`). wait/submit kill a daemon silent for `stall_kill_s` (default 600; 0 never kills), but never one whose phase is a landing phase or whose journal is past its commit; the kill goes to `killed.json` and into the job's next result (`killed`). At the local commit the journal is re-based (`committed` in inflight.json): a restart whose HEAD still holds the commit restores nothing and finishes the landing (`resume.mjs`; result `resumed`); a remote that moved meanwhile drops the commit to the remote tip and fails the job for a resubmit. A replacement daemon is started by `launch.mjs`: on Windows through Win32_Process.Create (hidden, outside the caller's process tree), elsewhere detached; it logs to `target/broker/logs/daemon-<time>-<pid>.log` (`--log auto`).
- **Resumed test runs** (KIT-T518, `test-record.mjs`): a restart after a stop, crash or watchdog kill reruns a `cargo nextest run` (or an alias expanding to it) with only the tests not yet passed. The command's streamed log keeps one `PASS` line per finished test; the restart reads it into `<broker home>/testrun/<job>.json` and adds `--no-tests=pass -E "not (<passes>)"`, ANDed with the command's own filterset (more than one `-E`, or a name with a space or parenthesis, runs in full). The record is keyed by the tree state, the patch and the commands: any change discards it and the run is full. The exclusion is cut off at about 7000 command characters (cmd.exe limit), so a very long list resumes partly, never wrongly. The command entry carries `resumedSkipped: N`; the record goes with the job's result. Trains, suite runs and plain `cargo test` do not resume.
- **Takeover** (KIT-T524, `takeover.mjs`): before a daemon runs a job it looks in every lane's and the root's home for an unfinished journal (`inflight.json`) that names the job, whose daemon is dead and which is not past a landing commit or a linked job's submodule push, and puts its pre-images back. A job an old-runtime root daemon half-applied in the root home therefore runs on the submodule's lane daemon instead of looping `dirty` on its own partial apply. Dirt with no journal for the job, a journal for another job, or a live daemon's journal still blocks.
- **Command timeout and running cancel** (KIT-T676, `command-limit.mjs`, `cancel-running.mjs`, `run-abort.mjs`): a job command the daemon runs is killed, process tree and all, once it has run `command_timeout_multiple` (default 4) times the longest passing run of that exact command in the results, never before `command_timeout_floor_s` (default 600; 0 turns the timeout off). The command entry carries `aborted: { kind: "timeout", message }`, its log ends with a `[broker] timed out` line and the job fails `timed out`; a train that times out fails whole, without bisection. `broker.mjs cancel <id> --running` kills the running job's command tree the same way; the job ends `cancelled` (in a train only the named member does and the rest rebuild without it). A job in its landing phases (commit, pre-push gate, push, pin) is never cancelled or timed out by this: the cancel is refused.
- **File-lock retry** (KIT-T675, `file-lock.mjs`): a command whose log shows cargo's `failed to remove file `<path>` … Access is denied (os error 5)` runs again after 1 s, 3 s and 8 s; each retry logs the processes running that executable (Win32_Process by path) or says none does (a scanner). The result's `recovered` carries the notes.
- **Batch window** (KIT-T683, `batch-window.mjs`; `batch_window_s`, default 0 = off): with a value above 0 a lone trainable job waits up to that long for a peer while two or more sessions have been active in the last 10 minutes; a second queued job, an expired window, a single active session or a non-trainable job (manifest, pin, test-only) releases it at once. Replaying the 2026-10-28 dirt-empire queue (247 jobs) at 60 s and 90 s saves 1 build of 238 and raises the median wait: only 20 of 134 trainable jobs had a disjoint peer within 60 s (36 within 5 min), so the default stays off.
- **Tiered tests are the default** (KIT-D110, promoting ST-D254/ST-D255): without a `broker:` setting a project gets `land_gate: affected` (compile every target, the tests the changed paths map to, and the whole test run of each workspace crate that depends on a touched crate through Cargo.lock; `affected.dependents: false` drops the dependents) and a nightly suite slot (`nightly_at`, default "02:00" local): once a day, when the queue is idle, the daemon runs `suite` and then the `nightly:` commands (the GPU, golden and performance tiers, e.g. `cargo t -P render -j 1`) on the committed HEAD, and files a regression naming the causing commit on red. A project keeps those tiers out of its default test profile. Opt out with `land_gate: full` or `suite_every: N` (the landing-count cadence, no nightly tiers). A render-crate trigger for the tiers is not built. `decision-promotion.mjs` (KIT-D111) lists project decisions about kit or framework concerns that no KIT/RG decision cites.
- **Heartbeat** (`heartbeat.mjs`): `wait.mjs` prints the job's queue position, or its running time and command, every `--heartbeat` seconds (default 60).

## Coexistence with a hand-driven writer

The daemon pauses (job stays queued) when the checkout holds a modified tracked file that
matches `broker.dirty_blocks` (default `**/*.rs`, `**/Cargo.toml`, `**/Cargo.lock`) or is a path
the job's patch edits, writes or deletes; or an untracked file matching `broker.untracked_blocks`
(default: derived from the checkout's tracked crates and `[workspace] members`, so cargo-built
new files like `tests/*.rs` pause it and an untracked standalone crate outside the workspace does not;
`**/*.rs`, `**/Cargo.toml` when no Cargo.toml is tracked). Any other dirty tracked
file (a hot-edited asset script) and other untracked files (assets, images) never pause it.
Every Cargo.lock in the repo and in each checked-out submodule (`locks.mjs`, KIT-T519: `rapid-game/rust/Cargo.lock` under a superproject job) is journalled with the patched paths, so a check-only run restores
what cargo rewrote, and a lock the run created is removed; a daemon killed mid-run gets the same restore at its next start. Check-only runs touch the live tree for the length of the run;
`broker pause` before a long hand edit, `resume` after. The daemon never commits the writer's
changes: landing is by explicit paths.

Who holds a paused tree (KIT-T568, `hand-hold.mjs`): the dirty result and its message list the dirty
paths; `wait` prints them with the hold's age and the session whose write ledger holds those paths
(`session <id>`, a probable holder, not proof); `broker status` shows the same line; the daemon log
carries it on every pause; after 5 minutes the self-check raises `hand-edit-hold` into
`health.json`, which orient prints as a `!!` line. A daemon started over a dirty tree (submit, wait
or by hand) names the paths and session at once. A hand edit to a build input of a lane whose daemon is
live gets a one-time warning from pre-write (`hooks/lib/broker-hand-edit.mjs`) naming the daemon, the
queue depth and `broker pause`. The edit is allowed: the pause is the design, the silence was the bug.

## Patch envelope

```
*** edit crates/x/src/lib.rs
<<<<<<< SEARCH
exact old text
=======
new text
>>>>>>> REPLACE
*** write crates/x/tests/new.rs
full content of a new file
*** delete old/path.rs
```

Flags: `--root --ticket --title --test <cmd> (repeatable) --repo <name> --land --revises <id>`.

## Job and result

Job (`queue/<id>.json`): `{ id, repo, base, ops, files:{path:blob}, commands, land, ticket,
title, revises, revision, submittedAt }`.

Result: `{ id, revises, revision, ticket, base, head, status: passed|failed|gate|stale|dirty|
landed, phase, gate:[{path,check,msg}], stale:[{index,path,reason,excerpt,since}],
commands:[{cmd,composed,exit,durationMs,log,logTail,errors,failedTests}], diffStat,
landed:{sha,superSha}, dirtyEntries, message, startedAt, finishedAt }`.

## Submodule patches (`--repo rapid-game`)

Paths are relative to the submodule; the whole protocol runs inside it (commit, push). A green
land then pins the superproject with a pathspec-only commit
(`chore: pin rapid-game <sha> — <title> (implements <ticket>) [no-log: submodule pin]`); it
refuses if anything is already staged and asserts only the pointer is staged.

**Stale pins** (KIT-T515, `pin-stale.mjs`): a landing `--pin name=<sha>` is refused with `stale` (phase `pin`, both shas named) unless <sha> equals or descends from the gitlink the superproject's HEAD records, checked at run time and again right before the commit, so a job that waited behind a newer pin never moves the gitlink backwards. A check-only job may build with any pin.

## Linked jobs (a superproject patch that also edits its submodule, KIT-T482 item 4)

A superproject job may edit paths inside a submodule, written from the superproject root (`*** edit rapid-game/crates/rg-ui/src/x.rs`). Those paths plan against the submodule commit the superproject records (`linked.mjs`), build and test together with the consumer change, and land as one unit: the submodule commit goes out first (with its own pre-push gate, on its `main`), then ONE superproject commit carries the consumer paths and the new gitlink. A red run lands neither half. If the superproject push fails after the submodule landed, the submodule stays at its pushed commit (its files are not restored) and the result names the sha to resubmit the consumer half with `--pin`. Once the submodule half is pushed the journal is re-based (`linked`, with the consumer files' patched bytes), so a daemon that dies before the superproject push is finished on restart (`resume.mjs`): the consumer files are put back, the commit is made unless git already made it, and pushed. A linked job never rides a train.

## Config — `broker:` in `.ai/config.yml`

```yaml
broker:
  target_dir: D:/dev/stiletto-2349/target   # the shared CARGO_TARGET_DIR
  parallelism:
    jobs: auto                               # default: every core the RAM feeds at 4 GiB a job (os error 1455 = pagefile); a number pins it
  verify_default:
    - cargo t                                # the project's fastdev alias
  # untracked_blocks: ["crates/**/*.rs"]   # absent = derived from the cargo layout (see above)
  dirty_blocks: ["**/*.rs", "**/Cargo.toml", "**/Cargo.lock"]   # tracked edits that pause the queue
  land_gate: affected                        # default full; affected = check + mapped tests (Fast landing)
  affected: { check: "cargo check --offline --workspace --all-targets", test: "cargo t --offline" }
  suite: ["cargo t --offline", "cargo run --offline --release --bin probe"]   # default verify_default
  suite_every: 3                             # landings between suite runs; default 1
  runner: nextest                            # default cargo; nextest merges a job's per-target test runs
  batch: 8                                   # most disjoint queued jobs one build carries (trains); 1 = one build per job
  incremental_keep_hours: 24                 # after a suite run, drop incremental caches unused this long; off disables
  stall_kill_s: 600                          # wait/submit replace a daemon silent this long; 0 never kills
  repos:
    - { name: stiletto,   path: ., main: main, remote: origin }
    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }
```

Defaults: `target_dir` `<root>/target`; `jobs` auto (`scripts/broker/jobs.mjs`); `verify_default` `["cargo test --no-fail-fast"]`;
`poll_ms` 2000.

## Guards

- `patch-worker` is read-only by tool list (`Read, Grep, Glob, Bash`), so `dispatch-guard`
  admits any number beside a writer.
- `dispatch-guard` check `broker-owned-tree`: while a live daemon holds a tree's lock, a
  writer-capable dispatch into it is blocked and pointed at `patch-worker`. Escape: the
  maintainer's quoted `[maintainer-asked-parallel: …]`; ignore-file id `broker-owned-tree`.
- Follow-up: a hard `patch-worker-guard` PreToolUse hook (blocks cargo and mutating git for that
  agent type) once a logged Bash payload from inside a subagent is shown to name the type.

## Tests

`node --test "scripts/broker/*.test.mjs"` over throwaway cargo-free git fixtures (a real
submodule included), plus `node hooks/dispatch-broker.test.mjs`.

- **One queue per repo, one directory per broker** (KIT-D096, KIT-D097, `lanes.mjs`, `reroute.mjs`, `cargo-scope.mjs`): a broker owns writes to ONE checkout directory and serves Cargo workspaces only. Nothing locks or waits across directories: two checkouts of one remote (two rapid-game directories, two repos) never share a lock or queue, and a push that loses a race with another checkout is refused by the remote and takes the refused-push path (fetch, rebase, re-gate, push; `sync-push.mjs`). The root lane serves every repo that is not a submodule; each `submodule: true` repo is its own lane under `target/broker/lanes/<repo>/` with its own queue, lock, results and daemon (`broker.mjs --lane <repo>`). `submit` writes a job to its repo's lane and starts that lane's daemon; `wait` and `cancel` find the job's lane by id; `status`, `stats` and orient cover every lane. A job found in the wrong lane is handed over. A submodule lane lands and pushes only; the superproject pin is a root-lane `--pin <sub>=<sha>` job, so no lane writes another repo. Inside one checkout the lanes DO wait on each other for the submodule's working tree (KIT-T517, KIT-T561, `subtree.mjs`): a root-lane job that runs cargo, pins or edits a path in the submodule takes that tree's lock and waits while the submodule lane runs a job or its pre-push gate, then the lane yields back. KIT-T680 tracks building the superproject against a snapshot of the pinned commit instead. The dispatch guard does not block lanes against each other: it blocks a writer only for a build input owned by a live lane (a `rapid-game/` path belongs to the rapid-game lane, everything else to the root lane), and a brief with no `[paths:]` is blocked by any live lane, named in the message. No landing orphans a commit: no force, mirror, delete or `+refspec` push; a push that cannot complete parks its commit on `refs/broker/undone/` and the result names the ref and sha; a gitlink is committed only for a submodule sha already on the remote's main; a lane whose submodule is detached at commits on no branch pauses naming the sha (`no-orphan.test.mjs`). A checkout with no tracked Cargo.toml is refused by `broker.mjs` and `submit.mjs` and ignored by the dispatch guard, and repos without a `broker:` config (claude-kit, Node repos) are never brokered. The broker owns only files whose change can fail a compilation (`build-globs.mjs`: `*.rs`, `Cargo.toml`, `Cargo.lock`, `.cargo/config*`, `rust-toolchain*`, plus `include!()` targets from `build-inputs.mjs`); docs, `.ai/`, scripts no build reads and `include_str!`/`include_bytes!` data (`.rhai`) are written directly, never pause the daemon, and a writer dispatch declaring only such paths (`[paths: a, b]`) passes the guard. Enforced by `scope-invariants.test.mjs` (no lock, queue or state path outside the checkout; non-Cargo refusal), `build-scope.test.mjs` (what pauses), `push-race.test.mjs` (two checkouts land at once, neither waits) and `hooks/dispatch-broker.test.mjs`.
- **Broker stats** (KIT-T506, `metrics.mjs`): `broker.mjs stats [--since 24h|7d|<ISO>] [--json]` reports queue wait, build/test/gate minutes, failure and red rates, batch sizes, per-session waits, stall kills, recovered/resumed/retried counts and the share of greens within 1.5x the single-job wall time (ST-T904); orient prints a 24 h rollup line.
- **Suite never holds a job** (KIT-T504, `suite-yield.test.mjs`): a queued job in any lane cancels a running suite within one poll. A suite put off `suite_max_landings` (default 10) landings or `suite_max_hours` (default 2) is reported OVERDUE in `broker status` and still waits for an empty queue; it never runs between queued jobs.
- **Warm, scoped submodule gate** (KIT-T559, KIT-T561, `prebuild.mjs`, `suite.mjs`, `gate-exclusive.test.mjs`): a repo with `pre_push: true` and `gate_prebuild: "cd rust && cargo t --no-run"` has every landing that reaches a crate build the gate's test binaries (the gate's own command and feature set, so the same fingerprints) after the job's tests, once per train; the gate then compiles nothing. The gate runs under the lane's submodule tree lock, so a root-lane job that builds over the tree waits and idle work yields (`lane-busy.mjs`): no other lane's cargo shares the target dir during a gate. A repo entry `suite: "npm run check:all"` gives that lane its own idle full run on the cadence, filing a regression naming the causing commit on red; a queued job in any lane cancels it.
- **Auto-pin** (KIT-T563, `autopin.mjs`): a consumer marks its submodule `auto_pin: true`. Every push of that submodule queues a pin-only job (`--pin <sub>=<sha> --no-patch --land --auto-pin <origin>`, KIT-T562) in each registered consumer's own queue through its own `submit.mjs`, whichever checkout landed the commit; nothing waits across checkouts. A consumer's missing commit is fetched at submit. A red pin keeps the old gitlink and files a bug in that consumer's repo; a stale pin files nothing. A `--pin` job with no operations (empty envelope or `--no-patch`) is valid anywhere.
- **Package-scoped checks** (KIT-T516, `alias.mjs`): a project cargo alias carrying `--workspace` (stiletto `t`) overrode `-p`, so `cargo t -p sim --lib` ran the whole workspace; a command naming `-p` is expanded without the workspace flag. The base re-run for attribution was already cached per tree state and command (`baseline.mjs`); it only re-ran because the widened command had not been seen.
