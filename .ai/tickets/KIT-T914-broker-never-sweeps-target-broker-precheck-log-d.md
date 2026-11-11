---
id: KIT-T914
title: broker never sweeps target/broker/precheck-*.log: dirt-empire holds several hundred precheck logs (oldest from job ids j-mvtva6mh, weeks old
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T17:07:53Z
updated: 2026-11-09T17:07:53Z
---

## Description
broker never sweeps target/broker/precheck-*.log: dirt-empire holds several hundred precheck logs (oldest from job ids j-mvtva6mh, weeks old) at the broker root, alongside -full variants and a stray .log.exit. Logs should go under logs/ and be swept with the job's retention like logs/j-*.log.

kit-bug-shape: cap:bug:broker-never-sweeps-target-broker-precheck-log-d
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 17:07] (created) bug — broker never sweeps target/broker/precheck-*.log: dirt-empire holds several hundred precheck logs (oldest from job ids j-mvtva6mh, weeks old
- [2026-11-09 17:48] (landed) 6e57a5a broker: precheck logs go under logs/ and job logs older than 14 days (plus legacy root precheck logs) are swept once a d
