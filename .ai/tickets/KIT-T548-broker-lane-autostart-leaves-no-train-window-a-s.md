---
id: KIT-T548
title: broker lane autostart leaves no train window: a submit to an idle lane spawns the daemon, which takes the first job alone; jobs submitted 0.
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T20:07:25Z
updated: 2026-10-16T21:32:14Z
fixed_commit: 4d7ed91
---

## Description
broker lane autostart leaves no train window: a submit to an idle lane spawns the daemon, which takes the first job alone; jobs submitted 0.9 s and 1.3 s later (RG-T215, a probe) missed the train and waited 15 min behind its 13-min pre-push gate (stiletto ST-T904 round 12, j-mvbd6g9r/6gxz/6h9s, runtime a671b7d). Expected: a short coalesce window at drain start (or on spawn) so back-to-back submits form one train.

kit-bug-shape: cap:bug:broker-lane-autostart-leaves-no-train-window-a-s
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 20:07] (created) bug — broker lane autostart leaves no train window: a submit to an idle lane spawns the daemon, which takes the first job alone; jobs submitted 0.
- [2026-10-16 21:32] (comment) @claude: fixed 4d7ed91: processOnce takes coalesceMs (broker.mjs passes broker.coalesce_ms, default 2000, 0 off, --once uses 0);  (full comment #1 in ## Notes)
### comment #1 [2026-10-16 21:32] @claude
fixed 4d7ed91: processOnce takes coalesceMs (broker.mjs passes broker.coalesce_ms, default 2000, 0 off, --once uses 0); a drain does not start until the newest queued submit is that old, capped at 5 windows from the oldest job, and the daemon re-ticks at min(poll, remaining wait). Stateless on job submittedAt, so it covers a daemon that was just spawned. Evidence: scripts/broker/train-window.test.mjs 4 passed: a second process writes three disjoint jobs 1 s apart and all three finish in one train (size 3, builds 1); control with coalesceMs 0 runs the first job alone (the pre-fix behaviour). broker glob 336 passed. Cost: up to 2 s extra latency on a lone submit.
- [2026-10-16 21:32] (status) todo → review
- [2026-10-16 21:32] (comment) train-window.test.mjs 4 passed
