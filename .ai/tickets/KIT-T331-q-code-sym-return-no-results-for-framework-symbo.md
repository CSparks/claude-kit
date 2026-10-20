---
id: KIT-T331
title: q: code/sym return (no results) for framework symbols from dirt-empire — 'q sym ScriptPiece', 'q code "pub struct ScriptPiece"', 'q code "fn
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-05T15:40:20Z
updated: 2026-10-20T00:53:26Z
fixed_commit: b6dd07f
---

## Description
q: code/sym return (no results) for framework symbols from dirt-empire — 'q sym ScriptPiece', 'q code "pub struct ScriptPiece"', 'q code "fn build_pieces_facet"', 'q code "pub fn positions"' all empty though dirt-empire/src/truck_art.rs imports rg_meshkit_script::ScriptPiece from the rapid-game submodule (2026-10-05)

kit-bug-shape: cap:bug:q-code-sym-return-no-results-for-framework-symbo
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-05 15:40] (created) bug — q: code/sym return (no results) for framework symbols from dirt-empire — 'q sym ScriptPiece', 'q code "pub struct ScriptPiece"', 'q code "fn
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) same as KIT-T327: framework symbols answer from the submodule (checked 2026-10-20); test scripts/q-gaps.test.mjs
