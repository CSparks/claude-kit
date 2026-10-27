---
id: KIT-T333
title: q: returns (no results) for symbols that exist in the rapid-game submodule (q code poly_tube_frame, q sym ScriptPiece, q file globs) — submo
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-05T19:25:07Z
updated: 2026-10-27T21:14:51Z
---

## Description
q: returns (no results) for symbols that exist in the rapid-game submodule (q code poly_tube_frame, q sym ScriptPiece, q file globs) — submodule sources appear unindexed from the dirt-empire checkout

kit-bug-shape: cap:bug:q-returns-no-results-for-symbols-that-exist-in-t
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code/sym/file find rapid-game symbols from a consumer checkout

## Plan
1.

## Notes
2026-10-27 Already fixed by 4e40561 (KIT-T341: index whole framework submodules, no .ai required). Verified from D:/dev/dirt-empire: q code poly_tube_frame, q sym ScriptPiece, q file 'rapid-game/**/engine.rs' all answer rapid-game hits. Test: scripts/code-index.test.mjs 'a framework submodule without a work store is indexed whole' (code-index: 24 passed, 0 failed). No new code. Publish ships nothing new for this.

## History
- [2026-10-05 19:25] (created) bug — q: returns (no results) for symbols that exist in the rapid-game submodule (q code poly_tube_frame, q sym ScriptPiece, q file globs) — submo
- [2026-10-27 21:14] (comment) criterion added: q code/sym/file find rapid-game symbols from a consumer checkout
- [2026-10-27 21:14] (comment) ticked: q code/sym/file find rapid-game symbols from a consumer checkout
- [2026-10-27 21:14] (status) todo → review
