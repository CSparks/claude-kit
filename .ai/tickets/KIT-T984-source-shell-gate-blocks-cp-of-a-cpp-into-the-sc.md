---
id: KIT-T984
title: source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file,
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T01:23:58Z
updated: 2026-11-11T02:29:40Z
fixed_commit: a19f1fa
---

## Description
source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file, or point the block at a safe backup route

kit-bug-shape: cap:bug:source-shell-gate-blocks-cp-of-a-cpp-into-the-sc
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A cp/mv/Copy-Item of a source file into the scratchpad (quoted path with spaces, MSYS drive form, -t, -Destination) passes source-shell-gate; a copy or move landing on a source path still blocks

## Plan
1.

## History
- [2026-11-11 01:23] (created) bug — source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file,
- [2026-11-11 02:21] (comment) criterion added: A cp/mv/Copy-Item of a source file into the scratchpad (quoted path with spaces, MSYS drive form, -t, -Destination) passes source-shell-gate; a copy or move landing on a source path still blocks
- [2026-11-11 02:22] (landed) a19f1fa hand-write-detect: a file git put back is no hand write (content equal to HEAD, or an earlier Edit's content in a call t
- [2026-11-11 02:29] (status) todo → review
- [2026-11-11 02:29] (comment) Fixed in a19f1fa (+7c947bb test fix); runtime publish refused: exported HEAD red on hooks/claim-release-controls.test.mjs (imports uncommitted hooks/lib/live-claims.mjs, KIT-T944 residual awaiting maintainer approval), so current has not moved
- [2026-11-11 02:29] (comment) ticked: A cp/mv/Copy-Item of a source file into the scratchpad (quoted path with spaces, MSYS drive form, -t, -Destination) passes source-shell-gate; a copy or move landing on a source path still blocks
- [2026-11-11 02:33] (landed) 10c2d90 pre-write keeps the whole content of a Write in the magic-number scan; a redirect and its target are cut from a cp's ope
- [2026-11-11 02:36] (comment) @claude: Cause: a quoted scratchpad path holding a space (C:/Users/Chris Sparks/...) was split into words by the operand scan, so (full comment #1 in ## Notes)
### comment #1 [2026-11-11 02:36] @claude
Cause: a quoted scratchpad path holding a space (C:/Users/Chris Sparks/...) was split into words by the operand scan, so its tail resolved inside the repo; the MSYS /c/ drive form was not recognised as temp. Fix a19f1fa and 10c2d90: copy/move destinations read quote-aware (hooks/lib/shell-copy-target.mjs), redirects cut from the operands, isSourcePath maps /c/ to c:/. Policy note: a mv is judged on its DESTINATION only (the source leaves the tree, which the after-the-fact detector also never flags), so an in-repo mv of a source file to a non-source name (mv src/a.cpp src/a.cpp.bak) now passes while rm still blocks; the work-store gate keeps judging every mv operand (judgeMoveSources). Tests: hooks/shell-copy-target.test.mjs.
