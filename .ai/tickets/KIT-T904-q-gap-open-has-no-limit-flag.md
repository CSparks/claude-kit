---
id: KIT-T904
title: q gap: 'open' has no --limit flag
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T20:01:56Z
updated: 2026-11-08T20:03:07Z
---

## Description
q open --limit 0

kit-bug-shape: q-gap:flag:open:--limit
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q open --limit N keeps the first N rows (0 = all) on the cache and scan paths; an unknown flag still errors; --help documents it (scripts/q-open.test.mjs 7 passed)

## Plan
1.

## History
- [2026-11-08 20:01] (created) bug — q gap: 'open' has no --limit flag
- [2026-11-08 20:03] (status) todo → doing
- [2026-11-08 20:06] (comment) criterion added: q open --limit N keeps the first N rows (0 = all) on the cache and scan paths; an unknown flag still errors; --help documents it (scripts/q-open.test.mjs 7 passed)
- [2026-11-08 20:06] (comment) ticked: q open --limit N keeps the first N rows (0 = all) on the cache and scan paths; an unknown flag still errors; --help documents it (scripts/q-open.test.mjs 7 passed)
