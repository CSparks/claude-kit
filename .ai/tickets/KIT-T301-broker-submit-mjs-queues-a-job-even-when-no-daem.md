---
id: KIT-T301
title: broker submit.mjs queues a job even when no daemon holds the broker lock (it exited on --idle-exit), so jobs sit unstarted with no signal; w
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T09:04:32Z
fixed_commit: 26a7af5c56ccefeb610283fae29678e235763e2a
updated: 2026-10-03T09:08:41Z
---

## Description
broker submit.mjs queues a job even when no daemon holds the broker lock (it exited on --idle-exit), so jobs sit unstarted with no signal; wait.mjs then just times out. Seen 2026-10-03: daemon idle-exited at 60 min, nine stiletto jobs queued into nothing for ~40 min. Fix: submit (and wait) detect a 

kit-bug-shape: cap:bug:broker-submit-mjs-queues-a-job-even-when-no-daem
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] submit starts a detached hidden broker when no live holder owns the lock, and wait warns 'no broker running' while its job is queued

## Plan
1.

## History
- [2026-10-03 09:04] (created) bug — broker submit.mjs queues a job even when no daemon holds the broker lock (it exited on --idle-exit), so jobs sit unstarted with no signal; w
- [2026-10-03 09:08] (comment) criterion added: submit starts a detached hidden broker when no live holder owns the lock, and wait warns 'no broker running' while its job is queued
- [2026-10-03 09:08] (comment) ticked: submit starts a detached hidden broker when no live holder owns the lock, and wait warns 'no broker running' while its job is queued
- [2026-10-03 09:08] (status) todo → review
- [2026-10-03 09:08] (comment) @sonnet55: (fixed) 26a7af5c56ccefeb610283fae29678e235763e2a

## Notes
Fix 26a7af5c56ccefeb610283fae29678e235763e2a: scripts/broker/ensure.mjs (ensureBroker with injectable spawner, noBrokerWarning), liveHolder in lock.mjs, wired into submit.mjs and wait.mjs. BROKER_NO_AUTOSTART=1 opts submit out (patch.test.mjs sets it: its CLI submit otherwise spawned a real daemon on a temp fixture). Tests: scripts/broker/ensure.test.mjs; mutations (always-spawn, warn-with-live-lock, spawn removed) each fail one; broker suite 57 passed.
