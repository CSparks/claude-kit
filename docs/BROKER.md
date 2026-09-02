# Build broker — one shared build environment for many editing agents

A central testing facilitator (KIT-T270). ONE Node process owns a project's build
checkout and its shared `CARGO_TARGET_DIR` and is the only thing that runs cargo there.
Many editing agents ("workers") edit in cheap git worktrees, commit, and submit JOBS; the
broker verifies and lands them serially. This buys one warm build, one writer on `main`,
no index sweeps by construction, N editing agents across efforts, and a linear verified
merge history.

Worker workflow: the `broker-worker` skill. This page is for the OPERATOR who runs the
broker, plus the protocol and schemas.

## The pieces (`scripts/broker/`)

- `broker.mjs` — the daemon. One per build checkout (lock-guarded). Drains the queue.
- `submit.mjs` — a worker writes a job, prints its id.
- `wait.mjs` — a worker blocks on a result, exits with the job status.
- `config.mjs` · `git.mjs` · `run.mjs` · `result.mjs` · `submodule.mjs` · `queue.mjs` ·
  `lock.mjs` — by-concern internals.

## Running the broker

```
# start the daemon (Ctrl-C to stop gracefully; it releases the lock)
node <kit>/scripts/broker/broker.mjs --root <build-checkout>

# drain the queue once and exit (ops / cron / a manual kick)
node <kit>/scripts/broker/broker.mjs --root <build-checkout> --once

# watch the queue + results (they are plain JSON files)
ls <build-checkout>/target/broker/queue
ls <build-checkout>/target/broker/results
```

Only one broker runs per checkout (a lock file under `target/broker/broker.lock`). A
crash leaves any in-flight job in the queue, so a restart re-queues it — start is
idempotent.

## Coexistence — the broker runs ONLY on a clean checkout

The broker refuses to start a job when the build checkout is dirty (any modified tracked
OR untracked file): it writes a `dirty` result and PAUSES the queue, re-checking each
tick. This is how a hand-driven writer and the broker share one checkout:

- While you edit the build checkout directly, the broker waits.
- When you are done, leave the checkout clean (commit or stash your own work) and say
  **"checkout free"** — the broker's next tick drains the queue.

"Dirty" is exactly `git status --porcelain` being non-empty. `target/` is gitignored, so
the broker's own control files never count.

## The protocol (per job)

1. Refuse + pause if the build checkout is dirty (`dirty` result).
2. Detached-checkout the lane branch tip and `git rebase main`. A worker's branch is
   checked out in that worker's live worktree, so the broker cannot `git switch` to it —
   it attaches HEAD to the commit (detached), which never collides. On conflict:
   `rebase --abort`, back to main, `conflict` result with the path list.
3. Run the job's commands (or the repo's `verify_default`) with the parallelism rules:
   `-j <jobs>` and, for `cargo test`, `--no-fail-fast` folded in; `CARGO_TARGET_DIR` set.
   Each command's stdout+stderr goes to `target/broker/logs/<id>-<n>.log`; stop at the
   first non-zero exit.
4. Write `target/broker/results/<id>.json` (below).
5. On `land: true` + green: `git switch main && git merge --ff-only <tip> && git push`,
   remove the worker's worktree, delete the branch, record the landed sha. For a submodule
   job, additionally re-pin the superproject (below). Switch back to main in every case.

## Job schema (`target/broker/queue/<id>.json`)

```json
{
  "id": "j-<base36 ts>-<rand>",
  "repo": "stiletto",
  "branch": "lane/some-ticket",
  "commands": ["cargo test -p foo --lib"],
  "land": false,
  "ticket": "ST-T123",
  "title": "short title",
  "worktree": "D:/dev/worktrees/some-ticket",
  "submittedAt": "2026-09-02T…Z"
}
```

`commands` may be omitted/empty — the broker fills the repo's `verify_default`.
`worktree` lets the broker free the branch on a green land.

## Result schema (`target/broker/results/<id>.json`)

```json
{
  "id": "j-…", "repo": "stiletto", "branch": "lane/some-ticket", "land": true,
  "ticket": "ST-T123",
  "status": "passed | failed | conflict | dirty",
  "commands": [
    { "cmd": "cargo test -p foo", "composed": "cargo test -p foo --no-fail-fast -j 3",
      "exit": 0, "durationMs": 8123, "logTail": ["…last ~60 lines…"],
      "log": "…/target/broker/logs/j-…-0.log" }
  ],
  "conflicts": ["path/if/conflict.rs"],
  "landed": { "sha": "<merged sha>", "superSha": "<superproject sha or null>" },
  "dirtyEntries": ["?? wip.txt"],
  "message": "human note when relevant",
  "startedAt": "…Z", "finishedAt": "…Z"
}
```

## Submodule jobs (`repo: rapid-game`)

A job whose `repo` is the submodule runs the whole protocol INSIDE the submodule path
(its own branches / main / push). On a green land the broker re-pins the superproject with
a PATHSPEC-ONLY commit:

```
git add rapid-game && git commit -m \
  "chore: pin rapid-game <sha> — <title> (implements <ticket>) [no-log: submodule pin]" \
  -- rapid-game && git push
```

It refuses if anything else is already staged and asserts the only staged path is the
submodule pointer — never `git add -A`, never `-a`. Unrelated unstaged noise in the
superproject is left untouched.

## Per-project config — a `broker:` section in `.ai/config.yml`

Example for stiletto (the superproject) + rapid-game (its submodule). This is the
CONFIG TO ADD to stiletto's `.ai/config.yml` when rolling the broker out there — it is
NOT added by this ticket (KIT-T270); stiletto's checkout is owned by another agent, and
the rollout is a separate step done once that checkout is free.

```yaml
broker:
  target_dir: D:/dev/stiletto-2349/target   # the shared CARGO_TARGET_DIR
  parallelism:
    jobs: 3                                  # -j 3 (Windows pagefile / os error 1455)
  verify_default:
    - cargo test -j 3 --no-fail-fast
  repos:
    - { name: stiletto,   path: ., main: main, remote: origin }
    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }
```

Defaults when a key is absent: `target_dir` → `<root>/target`; `parallelism.jobs` → 3;
`verify_default` → `["cargo test --no-fail-fast"]`; `poll_ms` → 2000.

## Dispatch-guard interplay

Workers dispatch with `isolation: worktree` into a Rust workspace, which the kit's
`dispatch-guard` gates. A worker never builds, so the guards' cost rationale does not
apply — clear them explicitly in the dispatch prompt (do NOT weaken the guards):

- `cold-worktree-build` → `[cold-build-ok: broker worker — never runs cargo; broker owns
  the only build]`.
- `parallel-dispatch` (blocks a 2nd agent in a Rust workspace) → for N workers state the
  cost: `[allow-parallel: N lanes, ~Xk tokens each, broker serializes all builds; workers
  only edit — no compile contention]`.
- `shared-tree-dispatch` does not fire for worktree isolation.

## Tests

`node --test scripts/broker/units.test.mjs scripts/broker/broker.test.mjs` — 11 tests over
throwaway cargo-free git fixtures (including a real submodule): clean run + land, failing
bounce, rebase conflict, dirty pause + restart re-queue, pathspec-only submodule pin,
lock, config parsing, and the cargo command composition.
