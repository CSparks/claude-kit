---
id: KIT-D114
title: The maintainer's checkout holds landed code only: the broker checks patches in its own check tree and writes the live tree only for a landing that already passed
summary: Check-only jobs and the checks of a landing run in a broker-owned git worktree under target/broker/check. The live checkout is written only by a landing, after its checks passed; `live tree: landed code only` or `PATCHED by <job>` is the one signal. Amends KIT-D039/KIT-D097 for the broker's own use; agents still never get a second working copy.
date: 2026-10-29
supersedes: 
source: dirt-empire 2026-10-29 14:49Z: job j-mvtns65p-bsnum6 applied a DE-T209 patch in the live checkout while Chris ran cargo r; KIT-T698; DE-D058 (superseded: its premise was parallel throwaway copies per job, not this)
---


**Decision:**
- A broker check run (a check-only job, a train of them, the gate of a landing) applies the patch, builds and tests in a broker-owned git worktree at `<target>/broker/check/<repo>`, synced to the live HEAD between jobs and kept so cargo builds incrementally. A superproject's check tree carries each submodule as a worktree at the sha HEAD records; a submodule lane has its own.
- The live checkout is written only by a landing, after the checks passed, and the landing reuses the green evidence instead of building again. A hand `cargo run` or a hand edit never meets a patch that has not passed.
- One reliable signal: `<broker home>/live-patched.json`, shown as `live tree: landed code only` or `live tree: PATCHED by <job> (<why>)` by `broker status` and orient. phase.json is cleared when a job ends and is not that signal.
- If the check tree cannot be made, the job runs in the live checkout as before, says so in the daemon log and marks the live tree patched for the run; `check_tree: false` turns the check tree off.
- This is a broker-internal worktree. KIT-D039 stands for agents: no agent gets a second working copy, branch or worktree.

**Why:** the broker applied every check-only patch to the maintainer's checkout and restored it afterwards; a hand `cargo run` in the same window compiled the patch (E0117 and E0603 that existed only in the patched tree). A separate target dir did not help, because the source is shared. Check runs also no longer hold the live submodule tree, which removes the root lane's wait on a submodule job for check-only work.

**Rejected:** a play-path wrapper that waits for the broker to be idle; restoring faster; throwaway copies per job (DE-D058, withdrawn).
