---
id: KIT-T378
title: broker: a passing job surfaces no program output (only failing jobs show log tails), so workers cannot read printed measurements (probe tabl
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T18:25:15Z
updated: 2026-10-06T18:25:15Z
---

## Description
broker: a passing job surfaces no program output (only failing jobs show log tails), so workers cannot read printed measurements (probe tables, sweep lines) without temporary file-writing patches; wait.mjs should return the job's stdout tail (or a --show-output flag) on success too

kit-bug-shape: cap:feature:broker-a-passing-job-surfaces-no-program-output-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 18:25] (created) feature — broker: a passing job surfaces no program output (only failing jobs show log tails), so workers cannot read printed measurements (probe tabl
