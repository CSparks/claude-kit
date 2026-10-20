---
id: KIT-T327
title: q: from D:/dev/dirt-empire, q code --path rapid-game/rust/assets/rg-meshkit-script and q sym MeshScriptEngine / ScriptPiece return (no resul
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T22:58:04Z
updated: 2026-10-20T00:53:23Z
fixed_commit: b6dd07f
---

## Description
q: from D:/dev/dirt-empire, q code --path rapid-game/rust/assets/rg-meshkit-script and q sym MeshScriptEngine / ScriptPiece return (no results) although the symbols exist in the rapid-game framework submodule (used by crates/dirt-empire/src/truck_art.rs). The submodule appears unindexed for this consumer; orient claims q covers 'this repo + its framework submodule'.

kit-bug-shape: cap:bug:q-from-d-dev-dirt-empire-q-code-path-rapid-game-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-04 22:58] (created) bug — q: from D:/dev/dirt-empire, q code --path rapid-game/rust/assets/rg-meshkit-script and q sym MeshScriptEngine / ScriptPiece return (no resul
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) not reproducible any more: q sym ScriptPiece and q code MeshScriptEngine --project dirt-empire both answer from rapid-game/rust/assets/rg-meshkit-script; new: an empty answer names a framework submodule that is not checked out (scripts/q-gaps.test.mjs)
