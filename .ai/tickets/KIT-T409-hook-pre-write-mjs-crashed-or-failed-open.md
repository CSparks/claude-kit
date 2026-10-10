---
id: KIT-T409
title: hook pre-write.mjs crashed or failed open
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T23:58:03Z
updated: 2026-10-10T00:26:30Z
fixed_commit: cf02dbe
---

## Description
file:///D:/dev/claude-kit/hooks/turn-writes.mjs:74 | const isStorePath = (p) => /(^|/).ai//.test(p); |                            ^^^^^

kit-bug-shape: hook-error:pre-write.mjs
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 23:58] (created) bug — hook pre-write.mjs crashed or failed open
- [2026-10-10 00:26] (comment) @claude: Noise: auto-filed by a broken regex the KIT-T407 writer wrote mid-task; fixed in the same landing (cf02dbe). No further action - close.
- [2026-10-10 00:26] (status) todo → review
