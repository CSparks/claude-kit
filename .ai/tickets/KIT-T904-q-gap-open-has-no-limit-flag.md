---
id: KIT-T904
title: q gap: 'open' has no --limit flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T20:01:56Z
updated: 2026-11-08T20:09:23Z
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

## Notes
Fixed 0680fae; runtime 0680fae published. scripts/q-open-args.mjs parses --limit/--limit= (count, 0 = all, never taken for the scope token) and withLimit slices on both q-lib (cache) and q-fallback (scan); q-gap flag table and q-help updated. q-open 7 passed, q 112, db-parity 21, q-server 8.

## History
- [2026-11-08 20:01] (created) bug — q gap: 'open' has no --limit flag
- [2026-11-08 20:03] (status) todo → doing
- [2026-11-08 20:06] (comment) criterion added: q open --limit N keeps the first N rows (0 = all) on the cache and scan paths; an unknown flag still errors; --help documents it (scripts/q-open.test.mjs 7 passed)
- [2026-11-08 20:06] (comment) ticked: q open --limit N keeps the first N rows (0 = all) on the cache and scan paths; an unknown flag still errors; --help documents it (scripts/q-open.test.mjs 7 passed)
- [2026-11-08 20:09] (landed) 0680fae q open takes --limit N (0 = all) on the cache and scan paths, in the flag table and in --help (implements KIT-T904)
- [2026-11-08 20:09] (status) doing → review
