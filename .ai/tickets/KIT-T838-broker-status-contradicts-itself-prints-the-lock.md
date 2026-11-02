---
id: KIT-T838
title: broker status contradicts itself: prints the lock's spawn reason as present state and a deferred test 'waits on a HEAD move' after HEAD moved (dirt-empire 2026-11-02, daemon pid 37724)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T19:35:11Z
updated: 2026-11-02T19:43:57Z
---

## Description
Diagnosis: pid 37724 alive, beat fresh (age seconds), health.json 12:52; 'no daemon' was the lock's spawnedBy start reason, printed as present state. deferred.json head 10ec207 never un-defers because recheckDeferred runs only when no lane has queued or running work and the lane was continuously busy; the status text still said it waits on a HEAD move. Fix: one ALIVE/STALLED/DEAD line with heartbeat age; deferred wording says it waits for an idle queue once HEAD moved.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T488, KIT-T271, KIT-T541
Fix: scripts/broker/daemon-state.mjs daemonStateLine (ALIVE/STALLED/DEAD with heartbeat age; spawn reason printed as 'started <ts> by <spawner>'), used by broker.mjs status; summary.mjs says 'started' not 'spawned by'; deferred.mjs deferredLines says 'waits on an idle queue (HEAD has moved...)' once the repo HEAD differs from the recorded one. Diagnosis (read-only, dirt-empire): pid 37724 alive since 11:55:15, broker.beat fresh, health.json 12:52; the deferred re-run (recheckDeferred in queue.mjs) only runs when no lane has queued or running work, so under a continuous queue it never fires: that is by design (a re-check never delays real work) and is now stated. Tests: daemon-state 3 passed (negative controls: old beat with empty queue ALIVE, no holder DEAD, unmoved HEAD keeps the old wording), deferred-dedupe 6, deferred 6, stall 3 passed.

## History
- [2026-11-02 19:35] (created) bug — broker status contradicts itself: prints the lock's spawn reason as present state and a deferred test 'waits on a HEAD move' after HEAD moved (dirt-empire 2026-11-02, daemon pid 37724)
- [2026-11-02 19:43] (status) todo → review
- [2026-11-02 19:44] (landed) 9ff6b12 broker status prints one ALIVE/STALLED/DEAD line with the heartbeat age and shows the spawn reason as history; a deferre
