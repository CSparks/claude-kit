---
id: KIT-T1100
title: query-gate store-grep fired on a grep of a plain source file (crates/road-generator/src/fly_probe.rs) as 'searching the .ai work store', and
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T18:10:42Z
updated: 2026-11-12T18:23:07Z
---

## Description
query-gate store-grep fired on a grep of a plain source file (crates/road-generator/src/fly_probe.rs) as 'searching the .ai work store', and offered q fts (work items) as the exact equivalent instead of q code

kit-bug-shape: cap:bug:query-gate-store-grep-fired-on-a-grep-of-a-plain
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Diagnosis: query-gate RULE 1 tested the whole command text against the store regex, so a store word in a text-search PATTERN (notes/, .ai/) made a one-file source search a store-search with the q fts redirect. Fix (hooks/query-gate.mjs): a search-family command now judges store vs source by its path operands (searchPaths), not the pattern; Select-String keeps whole-command judging. A one-file source search then passes as it always did for other patterns (rule 2, KIT-T1069); a recursive source search with a store word is source-discovery with the q code redirect; a store target still gets store-grep with q fts. Tests: hooks/query-gate.test.mjs all PASS (132, 5 new KIT-T1100 cases). Commit 0a005db.

## History
- [2026-11-12 18:10] (created) bug — query-gate store-grep fired on a grep of a plain source file (crates/road-generator/src/fly_probe.rs) as 'searching the .ai work store', and
- [2026-11-12 18:18] (landed) 0a005db query-gate: the target decides store or source; a store word in a grep pattern no longer makes a source search a store-g
- [2026-11-12 18:23] (status) todo → review
