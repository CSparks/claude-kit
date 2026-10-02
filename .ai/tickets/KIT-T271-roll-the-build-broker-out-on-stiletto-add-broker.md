---
id: KIT-T271
title: Roll the build broker out on stiletto — add broker: config + start the daemon once its checkout is free
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T270]
files: []
supersedes:
superseded_by:
created: 2026-09-02T06:23:40Z
updated: 2026-09-02T06:23:40Z
---

## Description
The build broker (KIT-T270) ships in the kit but is NOT wired to stiletto — stiletto's
checkout is owned by another agent right now. This ticket is the rollout, done ONLY once
that checkout is "checkout free" (clean + handed over). It adds the `broker:` section to
stiletto's own `.ai/config.yml` (superproject + rapid-game submodule) and starts the
daemon. BLOCKED on stiletto being free; no stiletto files are touched before then.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] `broker:` section added to `D:\dev\stiletto-2349\.ai\config.yml` per the example in
      `<kit>/docs/BROKER.md` (target_dir = the shared CARGO_TARGET_DIR, jobs: 3, repos:
      stiletto + rapid-game with submodule/pin_in).
- [ ] `node <kit>/scripts/broker/broker.mjs --root D:\dev\stiletto-2349 --once` drains a
      clean queue with no error (smoke), and the daemon starts and holds its lock.
- [ ] A real check-only job for one stiletto crate returns `passed` through the broker,
      proving the warm shared `target/` is used.

## Plan
1. Confirm stiletto checkout is clean + free (the landing agent says so).
2. Add the `broker:` section to stiletto's `.ai/config.yml`.
3. Start the daemon: `node <kit>/scripts/broker/broker.mjs --root D:\dev\stiletto-2349`.
4. Smoke a check-only patch via the patch-worker skill (stdin envelope, wait.mjs); confirm `passed`. Start the daemon with background Bash: `node <kit>/scripts/broker/broker.mjs --root D:devstiletto-2349 --idle-exit 60`.

## History
- [2026-09-02 06:23] (created) feature — Roll the build broker out on stiletto — add broker: config + start the daemon once its checkout is free
- [2026-10-02 18:09] (comment) @chris: 2026-10-02 rollout prep under KIT-T276 L5: stiletto .ai/config.yml broker: section already present and corrected (verify (full comment #1 in ## Notes)
### comment #1 [2026-10-02 18:09] @chris
2026-10-02 rollout prep under KIT-T276 L5: stiletto .ai/config.yml broker: section already present and corrected (verify_default cargo t, stale worktree comment fixed); BROKER.md matches; smoke step now uses the patch-worker skill. NOT started: first daemon start on stiletto is the maintainer's call with Chris.
