---
id: KIT-D121
title: Build and broker timing is measured continuously and blockers are worked down, self-correcting; no static timing thresholds
summary: Every broker job is timed by phase (slot queue, compile, test, gate) all the time. A rolling profile ranks where wall time goes, and the top blockers continuously become work. The system corrects itself wherever it can (re-tiering, re-scoping, re-ordering) rather than waiting on a human or a fixed number. No static timing threshold decides what counts. This overrides the static own-time filter chosen in KIT-Q004 option A and amends how KIT-D104 is measured.
date: 2026-10-30
supersedes: 
source: Chris 2026-10-30, infra session, verbatim below
revised: 2026-10-31
---


**Decision:** Every broker job is timed by phase, all the time. A rolling profile ranks the biggest time sinks against recent history. The system makes every correction it safely can (measured before and after, reverted if it does not help) and turns the rest into ranked tickets. No static timing threshold decides what counts. Nothing is refused or killed for being long; the target is waste (rebuilding more than the change needs, test runs broader than the change reaches, cold caches), measured directly.

**Maintainer:** Chris, verbatim, 2026-10-30:
- "NOTHING about timing should be static. We should be CONSTANTLY timing and improving blockers because there is no fucking roadmap for this shit."
- "But it should be self-correcting as much as possible."
- "Likewise, the goal is to get the times DOWN, not prevent things that unavoidably take a long time from running, just avoiding stupid shit like rebuilding the ENTIRE codebase from scratch to run ONE fucking test."

**Why:** Chris, verbatim: "because there is no fucking roadmap for this shit."

**Assistant-added:** this ruling came right after KIT-Q004 was resolved as option A, which would have filed an overrun only when a job's own time passed a fixed 300 s and kept slot-queue minutes in metrics. The ruling replaces that filter. The broker records timing for every job by phase, ranks the biggest time sinks against recent history, applies corrections it can make on its own, and turns the rest into ranked tickets. Slot-queue wait is ranked as a blocker like any other.
