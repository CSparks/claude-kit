# Build broker — a single-checkout patch queue

KIT-T270 built it; KIT-T276 reworked it (design: `docs/design/broker-patch-queue.md`).
ONE Node daemon per checkout is the only writer: it applies queued patches, runs the gates,
builds and tests with the checkout's shared `CARGO_TARGET_DIR`, and lands green patches on
`main` by explicit paths. Any number of read-only `patch-worker` agents read the tree and
queue patches; none writes or builds. No worktrees, no lane branches. The daemon costs no
tokens; stuck patches escalate to the orchestrator.

Worker workflow: the `patch-worker` skill. This page is for the OPERATOR.

## The pieces (`scripts/broker/`)

- `broker.mjs` — the daemon; also `pause` / `resume`.
- `submit.mjs` — a worker pipes a patch envelope on stdin; prints the job id.
- `wait.mjs` — blocks on a result (default 540 s), exits with the status, prints the queue
  position on timeout.
- by concern: `envelope` (parse) · `apply` (in-memory dry run) · `patch` (one job) · `gate`
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
5. `land` — with `--land` and green: `git add` + `git commit -- <paths>` (never `-a`/`-A`),
   message `<title> (implements <ticket>)`, push `main`. `--land` needs `--ticket`.

## Coexistence with a hand-driven writer

The daemon pauses (job stays queued) when the checkout holds a modified tracked file that
matches `broker.dirty_blocks` (default `**/*.rs`, `**/Cargo.toml`, `**/Cargo.lock`) or is a path
the job's patch edits, writes or deletes; or an untracked file matching `broker.untracked_blocks`
(default `**/*.rs`, `**/Cargo.toml`: cargo discovers new `tests/*.rs`). Any other dirty tracked
file (a hot-edited asset script) and other untracked files (assets, images) never pause it.
Every Cargo.lock in the repo is journalled with the patched paths, so a check-only run restores
what cargo rewrote. Check-only runs touch the live tree for the length of the run;
`broker pause` before a long hand edit, `resume` after. The daemon never commits the writer's
changes: landing is by explicit paths.

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

## Config — `broker:` in `.ai/config.yml`

```yaml
broker:
  target_dir: D:/dev/stiletto-2349/target   # the shared CARGO_TARGET_DIR
  parallelism:
    jobs: 3                                  # -j 3 (Windows pagefile, os error 1455)
  verify_default:
    - cargo t                                # the project's fastdev alias
  untracked_blocks: ["**/*.rs", "**/Cargo.toml"]
  dirty_blocks: ["**/*.rs", "**/Cargo.toml", "**/Cargo.lock"]   # tracked edits that pause the queue
  repos:
    - { name: stiletto,   path: ., main: main, remote: origin }
    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }
```

Defaults: `target_dir` `<root>/target`; `jobs` 3; `verify_default` `["cargo test --no-fail-fast"]`;
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
