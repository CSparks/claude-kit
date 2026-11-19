---
id: KIT-T1415
title: job-capability decide (capability-research.mjs recordDecisionRow) appends a 2-column '| job | M (...) |' row at the end of a research note w
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T00:55:43Z
updated: 2026-11-19T00:55:43Z
---

## Description
job-capability decide (capability-research.mjs recordDecisionRow) appends a 2-column '| job | M (...) |' row at the end of a research note whose table has more columns (Rank|Job|Family|Verdict|Basis), after the Exceptions section, so the coverage parser cannot read it and decide then refuses to re-date: write the row in the note's own table shape, inside the table (seen 2026-11-18, run-monitor row)

kit-bug-shape: cap:bug:job-capability-decide-capability-research-mjs-re:b07a5fef
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-19 00:55] (created) bug — job-capability decide (capability-research.mjs recordDecisionRow) appends a 2-column '| job | M (...) |' row at the end of a research note w
