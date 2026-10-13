---
id: KIT-T325
title: q gap: 'fts' has no --limit flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T22:48:52Z
updated: 2026-10-13T19:49:47Z
---

## Description
q fts dispatch ladder sonnet stale project config --limit 8

kit-bug-shape: q-gap:flag:fts:--limit
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-04 22:48] (created) bug — q gap: 'fts' has no --limit flag
- [2026-10-06 14:39] (comment) seen again in dirt-empire: q fts panel gray --limit 10
- [2026-10-06 14:39] (comment) seen again in dirt-empire: q fts panels grey --limit 10
- [2026-10-12 20:04] (comment) seen again in stiletto-2349: q fts depleted deposit disappear --limit 8
- [2026-10-13 19:49] (comment) @sonnet55: Fixed 8c2614d: q fts takes --limit N (0 = all). Tests: scripts/q.test.mjs (+3), npm test exit 0.
- [2026-10-13 19:49] (status) todo → review
