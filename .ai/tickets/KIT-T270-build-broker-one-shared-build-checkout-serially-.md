---
id: KIT-T270
title: Build broker — one shared build checkout serially verifies + lands worker jobs from cheap worktrees
type: feature
status: doing
priority: medium
milestone:
labels: []
links: [KIT-D071]
files: []
supersedes:
superseded_by:
created: 2026-09-02T06:05:16Z
updated: 2026-09-02T06:05:50Z
---

## Description
A central testing facilitator so many editing agents share ONE build environment
(Chris 2026-09-02: "split this up amongst agents in the best possible way, which means
some kind of central testing facilitator to avoid multiple environments"). ONE Node
process owns a project's build checkout + shared CARGO_TARGET_DIR; workers edit in cheap
git worktrees (no target dir, no cargo), commit, and SUBMIT a JSON job. The broker
serially rebases each job's branch onto main in the build checkout, runs the commands
(logs to files), writes a result, and on `land: true` + green does an ff-only merge +
push (+ a pathspec-only superproject re-pin for submodule jobs). Dependency-free Node,
Windows-first. Home: `scripts/broker/` + a worker skill + an operator doc + a per-project
`broker:` config section. Buys one warm build, one writer on main, no index sweeps by
construction, N editing agents across efforts, a linear verified merge history.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] `scripts/broker/broker.mjs` runs one serial daemon per checkout: lock file, SIGINT
      graceful stop, idempotent restart re-queues unfinished jobs.
- [x] Per job the broker refuses on a dirty build checkout (writes a `dirty` result,
      pauses), else rebases the branch onto main in the build checkout, bouncing on
      conflict with the conflict list.
- [x] Commands run with the project's parallelism rules: default `-j 3`, `--no-fail-fast`
      appended to `cargo test`, `CARGO_TARGET_DIR` set; each command's stdout+stderr to
      `target/broker/logs/<id>-<n>.log`; stop at first non-zero exit.
- [x] Result `target/broker/results/<id>.json` carries per-command exit codes, durations,
      last ~60 log lines, and status passed|failed|conflict|dirty.
- [x] On `land: true` + green: `git switch main && git merge --ff-only <branch> && git push`,
      branch deleted, landed sha recorded; switch back to main in every case.
- [x] Submodule job (`repo: rapid-game`) runs the protocol inside the submodule path and,
      on land, re-pins the superproject with a PATHSPEC-ONLY commit (`git add rapid-game …
      -- rapid-game`) after asserting nothing else is staged. Never `git add -A`, never `-a`.
- [x] `scripts/broker/submit.mjs` writes the job + prints the id; `scripts/broker/wait.mjs
      <id> [--timeout s]` polls the result with a bounded sleep and exits with the job status.
- [x] Per-project `broker:` config in `.ai/config.yml` read by a minimal parser: repos
      {name,path,main,remote}, target_dir, parallelism {jobs}, submodule pin rule,
      verify_default.
- [x] `skills/broker-worker/SKILL.md` (worker workflow) + a `broker` operator doc under
      `docs/`; hook-interplay escape tokens for a worker in a broker worktree documented,
      dispatch-guard NOT weakened for the non-worktree case.
- [x] `node --test` suite over a throwaway cargo-free fixture repo covers: clean run + land,
      failing command bounce, rebase conflict bounce, dirty-checkout pause, pathspec-only
      submodule pin (real submodule fixture), restart re-queue, lock file, and a smoke test
      asserting the composed cargo command gets `-j 3 --no-fail-fast` + CARGO_TARGET_DIR.

## Plan
1. `config.mjs` — minimal `broker:` section parser + defaults.
2. `git.mjs` — checkout state, rebase-onto-main, ff-only merge/push, branch delete (per repo/submodule path).
3. `run.mjs` — compose commands (cargo `-j`/`--no-fail-fast`/CARGO_TARGET_DIR), spawn, log to files.
4. `result.mjs` — result/job schema read+write, log-tail capture.
5. `submodule.mjs` — pathspec-only superproject re-pin.
6. `queue.mjs` — serial job loop, lock, dirty pause, restart re-queue.
7. `broker.mjs` / `submit.mjs` / `wait.mjs` — CLIs.
8. `broker.test.mjs` — node --test over a temp fixture (+ a real-submodule fixture).
9. `skills/broker-worker/SKILL.md` + `docs/BROKER.md`.

## Notes

Built under `scripts/broker/` (by-concern, all files < 220 lines): `config.mjs`
(broker section parser + minimal YAML subset), `git.mjs`, `run.mjs`, `result.mjs`,
`submodule.mjs`, `queue.mjs`, `lock.mjs`, `cli.mjs`, and the three CLIs `broker.mjs` /
`submit.mjs` / `wait.mjs`. Worker skill `skills/broker-worker/SKILL.md`; operator doc
`docs/BROKER.md`; skill registered in `.claude-plugin/plugin.json`; tests wired into
`package.json`.

Design decisions (recorded in DECISIONS.md too):
- KIT-D071 DETACHED-CHECKOUT VERIFICATION: a worker's `lane/*` branch is checked out in
  that worker's live worktree, so the build checkout CANNOT `git switch <branch>` (git
  refuses a branch checked out elsewhere). The broker verifies via `git switch --detach
  <branch>` (HEAD attaches to the commit, not the branch) then rebases; a green land
  fast-forwards main to the rebased tip. This departs from the brief's literal `git
  switch <branch>` for correctness under live worktrees.
- BROKER FREES THE BRANCH ON LAND: the job carries the worker's `worktree` path; on a
  green land the broker `git worktree remove --force`s it, then deletes the branch (a
  branch held by a worktree cannot be deleted). The worker's post-land teardown is then
  just confirmation.
- CONTROL DIRS UNDER `<targetDir>/broker`: queue/results/logs/lock live beside the build
  cache under the gitignored `target/`, so the broker's own state never dirties the
  checkout (which would otherwise pause every job).
- `-j <jobs>` folded into any cargo build-shaped subcommand (test/build/check/clippy/
  bench/nextest); `--no-fail-fast` only into `cargo test`. Both idempotent (never
  duplicate a flag already present).

Evidence: 11 passed — `node --test scripts/broker/units.test.mjs
scripts/broker/broker.test.mjs` (5 unit + 6 integration over throwaway cargo-free git
fixtures incl. a real submodule): clean run + land (ff-only, branch + worktree torn
down), failing bounce with log tail, rebase-conflict bounce, dirty pause + restart
re-queue, CARGO_TARGET_DIR injection, pathspec-only submodule re-pin (stray super change
left untouched), lock reclaim, config parse, cargo composition smoke.

Follow-up (separate ticket): the stiletto rollout — add the `broker:` section to
stiletto's `.ai/config.yml` and start the daemon — is deferred until stiletto's checkout
is "checkout free" (owned by the landing agent now). Example config is in docs/BROKER.md;
this ticket does NOT touch stiletto's tree.

## History
- [2026-09-02 06:05] (created) feature — Build broker — one shared build checkout serially verifies + lands worker jobs from cheap worktrees
- [2026-09-02 06:05] (status) todo → doing
