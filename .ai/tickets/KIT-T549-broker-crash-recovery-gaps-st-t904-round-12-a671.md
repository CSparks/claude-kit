---
id: KIT-T549
title: broker crash recovery gaps (ST-T904 round 12, a671b7d): after a hard kill of the root daemon mid-run, (a) the dead daemon's cargo children k
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T20:07:26Z
updated: 2026-10-20T03:10:04Z
fixed_commit: 84821fa
---

## Description
broker crash recovery gaps (ST-T904 round 12, a671b7d): after a hard kill of the root daemon mid-run, (a) the dead daemon's cargo children kept running and the replacement's re-run sat 'Blocking waiting for file lock on artifact directory' (run 275 s vs ~212 s); the replacement should kill the recorded child tree; (b) the re-run overwrote <job>-0.log, losing the killed run's evidence; (c) a replacement only starts because a wait.mjs was polling, with no waiter the queue stalls (HEALTH no-daemon); (d) the root job's pin checkout left rapid-game DETACHED at its gitlink e9cae518 while rg main is 4c8ea4d5, the KIT-T520 hazard for the next lane landing; restore the submodule branch after a root job.

kit-bug-shape: cap:bug:broker-crash-recovery-gaps-st-t904-round-12-a671
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 20:07] (created) bug — broker crash recovery gaps (ST-T904 round 12, a671b7d): after a hard kill of the root daemon mid-run, (a) the dead daemon's cargo children k
- [2026-10-16 20:52] (comment) @claude: (d) fixed 56e2b14: the submodule lock records the submodule's branch/sha before a superproject job's pin checkout; relea (full comment #1 in ## Notes)
### comment #1 [2026-10-16 20:52] @claude
(d) fixed 56e2b14: the submodule lock records the submodule's branch/sha before a superproject job's pin checkout; release restores it, and a replacement daemon that finds a dead holder's lock restores it before running (reconcileSubtrees at daemon start, takeSubtrees on reclaim). Never over a checkout on a branch (a landing's settlePins result) or uncommitted work. Evidence: subtree.test.mjs 'after a hard kill mid-pin...' and 'a pin job re-run after the daemon died mid-pin leaves the submodule on its branch' (red before), negative 'a live holder keeps its lock, and a stale superproject lock never discards uncommitted work'; broker glob 324 passed. (a)-(c) open.
- [2026-10-16 21:32] (comment) @claude: (a)(b)(c) fixed b042ccd. (a) scripts/broker/children.mjs: the daemon records each command tree it starts (run-cancellabl (full comment #2 in ## Notes)
### comment #2 [2026-10-16 21:32] @claude
(a)(b)(c) fixed b042ccd. (a) scripts/broker/children.mjs: the daemon records each command tree it starts (run-cancellable, run-pulsing) in target/broker/<lane>/children.json; at start a replacement daemon (broker.mjs, before the journal restore) ends every recorded tree whose daemon is dead and which has no exit marker. (b) the killed run's log is COPIED to <job>-N.interrupted.log (a second interruption becomes interrupted-2); the original is left in place because the nextest resume (test-record.mjs) reads it, and the re-run then overwrites it. (c) chosen: submit and 'broker.mjs status' call ensureQueuedLanes, which starts a daemon behind every lane that holds queued jobs and none live (BROKER_NO_AUTOSTART opts out); no new watchdog process. Evidence: scripts/broker/crash-recovery.test.mjs 5 passed, the orphan test and the status test red before (command survived, no interrupted log, nothing started); controls: finished/live-daemon/other-host records untouched. broker glob 336 passed. Windows note: libuv may kill non-detached children when their daemon dies; the test starts its stand-in child detached to make the survival deterministic.
- [2026-10-16 21:32] (status) todo → review
- [2026-10-16 21:32] (comment) crash-recovery.test.mjs 5 passed; (d) 56e2b14 subtree.test.mjs
- [2026-10-20 03:10] (status) review → review
- [2026-10-20 03:10] (comment) (d) and the debris half: killed-job lockfile leftovers are now restored at the pin step and by broker.mjs restore; (a)-(c) were fixed earlier (children.json); test scripts/broker/restore.test.mjs
