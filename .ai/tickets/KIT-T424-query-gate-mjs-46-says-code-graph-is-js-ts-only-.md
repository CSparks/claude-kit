---
id: KIT-T424
title: query-gate.mjs:46 says code-graph is JS/TS-only, but code-graph.mjs:73 has a Rust family; the gate's redirect text is stale or wrong for Rus
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T16:38:58Z
updated: 2026-10-12T17:05:33Z
fixed_commit: e385687
---

## Description
query-gate.mjs:46 says code-graph is JS/TS-only, but code-graph.mjs:73 has a Rust family; the gate's redirect text is stale or wrong for Rust repos

kit-bug-shape: cap:bug:query-gate-mjs-46-says-code-graph-is-js-ts-only-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the query-gate code-graph redirect names the languages code-graph indexes (definitions: js, python, rust, go, c-family; import edges: JS/TS relative imports), read from one family table, and no longer claims JS/TS-only
- [x] hooks/query-gate.test.mjs asserts the redirect text; the new assertions fail against the old gate

## Plan
1.

## History
- [2026-10-12 16:38] (created) bug — query-gate.mjs:46 says code-graph is JS/TS-only, but code-graph.mjs:73 has a Rust family; the gate's redirect text is stale or wrong for Rus
- [2026-10-12 17:05] (comment) criterion added: the query-gate code-graph redirect names the languages code-graph indexes (definitions: js, python, rust, go, c-family; import edges: JS/TS relative imports), read from one family table, and no longer claims JS/TS-only
- [2026-10-12 17:05] (comment) criterion added: hooks/query-gate.test.mjs asserts the redirect text; the new assertions fail against the old gate
- [2026-10-12 17:05] (comment) ticked: the query-gate code-graph redirect names the languages code-graph indexes (definitions: js, python, rust, go, c-family; import edges: JS/TS relative imports), read from one family table, and no longer claims JS/TS-only
- [2026-10-12 17:05] (comment) ticked: hooks/query-gate.test.mjs asserts the redirect text; the new assertions fail against the old gate
- [2026-10-12 17:05] (comment) @claude: code-graph's FAMILIES table moved to scripts/code-graph-families.mjs; query-gate imports it for the NOTE line, renames G (full comment #1 in ## Notes)
### comment #1 [2026-10-12 17:05] @claude
code-graph's FAMILIES table moved to scripts/code-graph-families.mjs; query-gate imports it for the NOTE line, renames GRAPH_INDEXED_EXTS -> IMPORT_GRAPH_EXTS (behaviour unchanged: non-JS/TS greps q cannot answer exactly stay allowed, since code-graph has definitions but no import edges for them). Tests: hooks/query-gate.test.mjs 70 PASS, all pass (2 new assertions FAIL against the old gate); scripts/code-graph.test.mjs 53 passed; hooks/code-graph.test.mjs 2 passed; index-redirect 44 passed.
- [2026-10-12 17:05] (status) todo → review
- [2026-10-12 17:05] (comment) (fixed) e385687; query-gate.test.mjs 70 PASS
