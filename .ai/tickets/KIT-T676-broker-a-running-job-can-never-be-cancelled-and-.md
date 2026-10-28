---
id: KIT-T676
title: broker: a running job can never be cancelled and has no command timeout; dirt-empire j-mvskowvb-iinf3d (a withdrawn DE-T196 diagnostic) hung
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T20:55:30Z
updated: 2026-10-28T22:33:08Z
---

## Description
broker: a running job can never be cancelled and has no command timeout; dirt-empire j-mvskowvb-iinf3d (a withdrawn DE-T196 diagnostic) hung 20+ min in free_ride_drive (pid 31592, stalled on an rg-chunk-stream bug) and blocks the root lane. Needs a per-command timeout (multiple of the test's history) and 'cancel --running' that kills the child tree.

kit-bug-shape: cap:bug:broker-a-running-job-can-never-be-cancelled-and-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A job command past command_timeout (4x its longest passing run, floor 600 s) is killed with its process tree and the job fails 'timed out' (command-timeout.test.mjs)
- [x] broker.mjs cancel <id> --running kills the running job's command tree; the job ends cancelled, the tree is restored, the daemon carries on (command-timeout.test.mjs)

## Plan
1.

## Notes
Tests: scripts/broker/command-timeout.test.mjs 6 passed (limit maths, tree kill, timeout e2e through a daemon, cancel --running e2e, refusals). Runtime publish + daemon restart needed for dirt-empire.

## History
- [2026-10-28 20:55] (created) bug — broker: a running job can never be cancelled and has no command timeout; dirt-empire j-mvskowvb-iinf3d (a withdrawn DE-T196 diagnostic) hung
- [2026-10-28 22:18] (comment) criterion added: A job command past command_timeout (4x its longest passing run, floor 600 s) is killed with its process tree and the job fails 'timed out' (command-timeout.test.mjs)
- [2026-10-28 22:18] (comment) criterion added: broker.mjs cancel <id> --running kills the running job's command tree; the job ends cancelled, the tree is restored, the daemon carries on (command-timeout.test.mjs)
- [2026-10-28 22:18] (comment) ticked: A job command past command_timeout (4x its longest passing run, floor 600 s) is killed with its process tree and the job fails 'timed out' (command-timeout.test.mjs)
- [2026-10-28 22:18] (comment) ticked: broker.mjs cancel <id> --running kills the running job's command tree; the job ends cancelled, the tree is restored, the daemon carries on (command-timeout.test.mjs)
- [2026-10-28 22:33] (status) todo → review
