---
id: KIT-T621
title: broker pre-write gate crashed with V8 heap OOM (exit 134, Last few GCs) on crates/dirt-empire/src/vehicle.rs, job j-mvjo3p1h-5551ij; identic
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T622]
files: []
supersedes: KIT-T623
superseded_by:
created: 2026-10-22T15:13:34Z
updated: 2026-10-22T18:45:12Z
fixed_commit: 2a812ff
---

## Description
broker pre-write gate crashed with V8 heap OOM (exit 134, Last few GCs) on crates/dirt-empire/src/vehicle.rs, job j-mvjo3p1h-5551ij; identical resubmit passed

kit-bug-shape: cap:bug:broker-pre-write-gate-crashed-with-v8-heap-oom-e
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A pre-write hook that aborts (exit 134) is rerun up to 3 times; a pass on any rerun yields no finding
- [x] A hook that aborts on every attempt is a gate-crash naming the attempts and the fatal line (message tail, not head)
- [x] Negative control: a hook that blocks (exit 2) is never rerun

## Plan
1.

## Notes
ROOT CAUSE (2026-10-22). Not a heap growth: the crash log's last GCs read 5.2 MB to 7.2 MB, the hook's normal peak (it passes under --max-old-space-size=8, aborts at 4); the hook on vehicle.rs (141 lines) runs in 1 s. A V8 abort at a 7 MB heap is the OS refusing memory: the dirt-empire gate ran at 15:00 UTC while stiletto and the DE lane held the box (see KIT-T622: brokers multiply cargo -j, pagefile pressure). Identical resubmit passed. FIX: gate.mjs reruns a crashing hook up to 3 times (1.5 s apart) and reports the message TAIL (the FATAL ERROR line) instead of the head; machine build slots (KIT-T622) remove the pressure. KIT-T623 superseded by this ticket.
CORRECTION to the note above: no broker job's result window covers 15:00:10-15:00:45 UTC (stiletto landed 14:57:42, next job 15:06:27; DE lane idle 14:57:45-15:01:42), so the pressure source at that moment is unverified (an idle suite run, deferred recheck or non-broker process leave no result record). Proven: heap at crash equals the hook's normal peak, so the abort is the host refusing memory, not the gate growing. The retry recovers it whatever the source.
CORRECTION 2: the machine-wide build slot named above was built and backed out - it makes checkouts wait on each other, which KIT-D097 forbids (scope-invariants.test.mjs caught it). Shipped fix is the gate rerun + tail message only. Tests: scripts/broker/gate.test.mjs (3 new, mutation-checked: GATE_ATTEMPTS=1 fails the rerun test), health.test.mjs, land.test.mjs: 26 pass.

## History
- [2026-10-22 15:13] (created) bug — broker pre-write gate crashed with V8 heap OOM (exit 134, Last few GCs) on crates/dirt-empire/src/vehicle.rs, job j-mvjo3p1h-5551ij; identic
- [2026-10-22 17:33] (status) todo → doing
- [2026-10-22 17:36] (comment) criterion added: A pre-write hook that aborts (exit 134) is rerun up to 3 times; a pass on any rerun yields no finding
- [2026-10-22 17:36] (comment) criterion added: A hook that aborts on every attempt is a gate-crash naming the attempts and the fatal line (message tail, not head)
- [2026-10-22 17:36] (comment) criterion added: Negative control: a hook that blocks (exit 2) is never rerun
- [2026-10-22 18:43] (comment) ticked: A pre-write hook that aborts (exit 134) is rerun up to 3 times; a pass on any rerun yields no finding
- [2026-10-22 18:44] (comment) ticked: A hook that aborts on every attempt is a gate-crash naming the attempts and the fatal line (message tail, not head)
- [2026-10-22 18:44] (comment) ticked: Negative control: a hook that blocks (exit 2) is never rerun
- [2026-10-22 18:44] (status) doing → done
- [2026-10-22 18:45] (status) done → done
