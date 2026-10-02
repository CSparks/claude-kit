# Broker as a single-checkout patch queue (KIT-T276)

Decided 2026-10-02 (KIT-T276 comments #2-#3). The broker daemon is the ONE writer per checkout:
it applies queued patches, runs gates, builds, tests, commits to main by explicit paths, pushes.
Workers are a read-only `patch-worker` agent type that submits patches on stdin and waits for
results. No worktrees, no lane branches. Stuck patches escalate to the orchestrator.

## 1. Patch format and submit
- Envelope of search/replace blocks on stdin to `submit.mjs` (no file in the tree):
  ```
  node <kit>/scripts/broker/submit.mjs --root <tree> --ticket ST-T123 --title "…" \
    --test "cargo t -p rg-sim --lib relevance" [--land] [--revises j-…] <<'PATCH'
  *** edit crates/sim/src/relevance/step.rs
  <<<<<<< SEARCH
  …exact old text…
  =======
  …new text…
  >>>>>>> REPLACE
  *** write crates/sim/tests/x.rs
  …full content…
  *** delete path/y.rs
  PATCH
  ```
  `--diff` accepts a unified diff as a secondary form.
- Job records `base` = HEAD sha and each touched file's blob sha. Apply is content-addressed:
  an edit applies to current main while its SEARCH text matches exactly once.
- `submit.mjs` dry-runs every op in memory against `git show HEAD:<path>`; misses return in
  seconds as `stale`: per failing op the index, path, reason (`not-found` / `ambiguous xN` /
  `create-exists`), the closest current excerpt, HEAD sha, `git log base..HEAD -- <path>`.
  Worker re-reads and resubmits with `--revises <id>`.

## 2. Writer
- The Node daemon (zero tokens). One per checkout via the existing lock.
- Orchestrator starts it with background Bash; new `--idle-exit <min>`; restart is idempotent.
- Orient/Stop list lands from `results/` since the last turn (land-alert only sees in-turn commits).

## 3. Phases and result
Order, stop at first failure: `submit-dryrun` → `gate` → `apply` → `run` → `land` (if `--land`
and green).
- `gate`: run `hooks/pre-write.mjs` per touched file with a synthesized
  `{tool_name:'Write', tool_input:{file_path, content}}` payload (reuse, no fork).
- Check-only (no `--land`): record pre-images (`git hash-object -w`) in
  `target/broker/inflight.json`, restore byte-for-byte after the run; a restart restores from the
  journal first.
- Result: `{id, revises, revision, ticket, base, head, status: passed|failed|gate|stale|dirty|landed,
  phase, gate:[{path,check,msg}], stale:[…], commands:[{cmd,composed,exit,durationMs,log,
  errors:[rustc blocks keyed by file], failedTests:[names], logTail}], diffStat,
  landed:{sha,superSha}, queue:{position}}`.
- `wait.mjs` default timeout 540 s (Bash caps at 600 s); on timeout print queue position.

## 4. Coexistence with the live checkout
- Pause on modified tracked files (`--untracked-files=no`).
- Also pause on untracked files matching `broker.untracked_blocks` (Rust default `**/*.rs`,
  `**/Cargo.toml` — cargo auto-discovers `tests/*.rs`).
- Ignore other untracked files (glb, png, audio, jpg).
- Refuse a `write` op onto an existing untracked path (`stale: create-exists`).
- Commit by explicit paths only (`git commit -- <paths>`), never `-a`/`-A`.
- `broker pause` / `broker resume` commands; orient shows `inflight.json`.

## 5. Guards
- `agents/patch-worker.md`: `tools: Read, Grep, Glob, Bash`, model pinned per the ladder
  (sonnet 5.5). Read-only by tool list, so dispatch-guard already admits N of them.
- dispatch-guard check `broker-owned-tree`: while `target/broker/broker.lock` is held by a live
  pid for the target tree, block writer-type dispatches into it and point to `patch-worker`;
  only escape `[maintainer-asked-parallel:]`.
- branch-guard unchanged.
- Hard patch-only guard is a follow-up: first log one Bash PreToolUse payload from inside a
  subagent; if it names the agent type, add `patch-worker-guard` blocking cargo and mutating git.
- Remove retired `[cold-build-ok]` / `[allow-parallel]` from BROKER.md and the skill.

## 6. Deletions and build order
- Delete lane machinery: git.mjs `checkoutDetached`, `rebaseOnto`, `deleteBranch`,
  `removeWorktree`, `unmergedFiles`; job fields `branch`/`worktree`; rebase/teardown path in
  queue.mjs. `skills/broker-worker` → `skills/patch-worker`. BROKER.md rewritten.
  `submodule.mjs` stays (rapid-game jobs commit in the submodule, pin the superproject by path).
- Rollout blockers: `composeCommand` ignores the `cargo t/b/r` aliases; stiletto
  `verify_default` is plain `cargo test` (flips fastdev; must be `cargo t`); stale
  "workers edit in worktrees" comment in stiletto `.ai/config.yml`.

| # | Landing | Test |
|---|---|---|
| L1 | Pause rule; `cargo t/b/r` composition; wait 540 s; stiletto `verify_default: cargo t` | clean tracked tree + untracked `assets/x.glb` runs (fails today); untracked `crates/a/tests/x.rs` pauses; `cargo t -p x` gets `--no-fail-fast -j 3` |
| L2 | Envelope parser, submit dry-run, content-addressed apply, `stale`, check-only restore journal | `submit` on stdin without `--branch` queues (fails today); moved base with intact block applies; missing block → `stale` with commits since base; after check-only, status + hashes identical incl. simulated crash/restart |
| L3 | Gate phase reusing pre-write.mjs | patch pushing a file over 600 lines → `gate`, tree untouched |
| L4 | Path-only land, ticket required, push, submodule pin, lane code deleted | landed commit `--name-only` equals patch paths; branch + worktree lists unchanged; adapted submodule pin test |
| L5 | patch-worker agent + skill, BROKER.md, `broker-owned-tree`, pause/resume, orient lands/inflight, KIT-T271 rollout | patch-worker dispatches while a writer is in flight; writer blocked while lock live; escape passes |
| L6 (later) | Batch disjoint patches per build, attribute failures, serial fallback | two patches, one broken → only it `failed` |
