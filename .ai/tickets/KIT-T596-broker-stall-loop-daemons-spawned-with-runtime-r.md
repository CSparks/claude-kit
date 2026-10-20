---
id: KIT-T596
title: broker stall loop: daemons spawned with runtime 'repo' never refresh target/broker/broker.beat (last write 19:20 local), so every submit/wai
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-20T00:36:00Z
updated: 2026-10-20T03:10:00Z
fixed_commit: 84821fa
---

## Description
broker stall loop: daemons spawned with runtime 'repo' never refresh target/broker/broker.beat (last write 19:20 local), so every submit/wait/status sees STALLED (>600 s), kills the live daemon mid-job and restarts it; observed 2026-10-20 00:30Z in dirt-empire lane root, 10+ kill/restart cycles in a minute while j-mvfxgyu6-ymxp7b re-ran

kit-bug-shape: cap:bug:broker-stall-loop-daemons-spawned-with-runtime-r
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-20 00:36] (created) bug — broker stall loop: daemons spawned with runtime 'repo' never refresh target/broker/broker.beat (last write 19:20 local), so every submit/wai
- [2026-10-20 02:06] (status) todo → todo
- [2026-10-20 03:10] (status) todo → review
- [2026-10-20 03:10] (comment) root cause of the kill loop: a poller read the stale beat file as a stall and killed each replacement before its first poll, and a busy daemon silent in sync code was killed with its command child alive; now a live child writing its log is never killed, a kill resets the beat, a new lock beats at once; tests scripts/broker/stall-busy.test.mjs 3 passed, stall/liveness 7 passed; published 84821fa. The original 10 min silence of daemon 58496 in the run phase is not explained (its log shows no error); the child-activity rule makes it harmless
