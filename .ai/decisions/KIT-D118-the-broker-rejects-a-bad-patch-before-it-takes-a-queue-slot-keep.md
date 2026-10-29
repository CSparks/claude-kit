---
id: KIT-D118
title: The broker rejects a bad patch before it takes a queue slot, keeps a warm check tree, and runs measurement jobs in an idle lane that never delays a landing
summary: submit runs the pre-write gate and a fast cargo check in the broker's own precheck tree and target dir; a fresh check-tree worktree takes the live tree's mtimes so it does not rebuild the workspace; a --measure job runs only as idle work and ends `measured`; a linked landing job waits for its submodule's auto-pin instead of failing.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29 in the dirt-empire session (DE-D062 follow-up)
revised: 2026-10-29
---


**Decision:**
- **Compile check off-queue.** Before a job enters the queue, `submit.mjs` runs the pre-write gate (the same gate a land runs) and, with `broker.precheck` (default on), `affected.check` in a broker-owned precheck tree with its own persistent target dir (`broker.precheck_timeout_s`, default 90). A gate failure or a rustc error prints the failed result and the job never takes a queue slot. A timeout, a held tree or an infrastructure failure queues the job as before; a timed-out precheck leaves its progress in the target dir, so the next one converges.
- **Warm check tree.** A fresh check-tree worktree takes the live tree's file mtimes (`mtime-align.mjs`). Cargo's package hash is relative to the workspace root, so the live and check trees share artifacts in one target dir; only the fresh files' mtimes forced a full recompile (a synthetic 30-crate workspace: 43.4 s before, 0.36 s after).
- **Measurement lane.** `submit.mjs --measure` queues a job that prints numbers and may fail by design. It is outside the landing queue, runs only as idle work in the check tree, is abandoned the moment any lane has a job queued, ends `measured`, never counts as a red run and never lands.
- **Linked landings wait for the pin.** A linked job (a superproject patch that edits submodule paths and lands both halves) is held while the submodule's local main is past the commit the superproject records and an auto-pin job for that submodule is queued (`linked-order.mjs`); with no pin queued it is held for 2 minutes, then runs and fails with the plain refusal. It is never failed back to the agent for an ordering the queue can fix. DE-T219 j-mvtsff2d failed in 0 s behind DE-T230's pin j-mvttdnn7.
- **Resume line.** Every final result appends `<ISO> <job id> <verdict> agent=<id|-> ticket=<id|->` to `target/broker/finished.log` (KIT-D115).

**Why:** Chris 2026-10-29, choosing the broker and agent fixes: "Compile check off-queue, Context ceiling, Ban polling, allow a single wait, Measurement lane, Agents being retired MUST write a handoff first." DE-T230: a cold rapid-game check-tree build timed out after 10 minutes; its check-only job passed and the land job failed the write gate in 4 seconds with no tests run, a whole queue round trip. DE-T219's linked land job ran before DE-T230's auto-pin and failed in 0 s.

**Rejected:** a precheck that shares the daemon's target dir (it blocks on cargo's directory lock behind a running job); a separate daemon per measurement (idle work already yields to landings); holding a linked job forever when no pin ever comes.
