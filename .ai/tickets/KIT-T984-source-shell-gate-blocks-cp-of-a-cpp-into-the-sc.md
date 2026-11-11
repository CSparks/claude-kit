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
- [2026-11-11 02:47] (landed) 41fdf80 WIP KIT-T984: copy-target controls for abbreviated and joined options (implements KIT-T984)
- [2026-11-11 02:47] (landed) 83406a4 WIP KIT-T984: block controls for unresolved destinations (implements KIT-T984)
- [2026-11-11 02:47] (landed) 0c3de8d WIP KIT-T984: gate-level move controls (implements KIT-T984)
- [2026-11-11 02:48] (landed) 2be7a29 WIP KIT-T984: tokenizing copy-target parser (implements KIT-T984)
- [2026-11-11 02:48] (landed) 98207ad WIP KIT-T984: move comment (implements KIT-T984)
- [2026-11-11 02:49] (landed) 6f8e93c WIP KIT-T984: copy branch calls judgeCopy (implements KIT-T984)
- [2026-11-11 02:49] (landed) 476e8d8 WIP KIT-T984: judgeCopy (implements KIT-T984)
- [2026-11-11 02:49] (landed) 05a8e51 WIP KIT-T984: gate lets a move leave the repo (implements KIT-T984)
- [2026-11-11 02:50] (landed) c3cd117 WIP KIT-T984: only a leading tilde is unexpanded (implements KIT-T984)
- [2026-11-11 02:51] (landed) db1d24e WIP KIT-T984: test labels (implements KIT-T984)
- [2026-11-11 02:54] (landed) bbfdb81 WIP KIT-T984: copy-target destinations (implements KIT-T984)
- [2026-11-11 02:54] (landed) 001149b WIP KIT-T984: strict allowlist copy grammar (implements KIT-T984)
- [2026-11-11 02:55] (landed) 87e76f6 WIP KIT-T984: scan collects every hit; proven copy shapes tag source hits (implements KIT-T984)
- [2026-11-11 02:56] (landed) 4ad4562 WIP KIT-T984: source write imports the collecting scan (implements KIT-T984)
- [2026-11-11 02:56] (landed) 85b7b56 WIP KIT-T984: shellSourceWrites head (implements KIT-T984)
- [2026-11-11 02:56] (landed) 5e29a47 WIP KIT-T984: shellSourceWrite is the first hit no destination can lift (implements KIT-T984)
- [2026-11-11 02:56] (landed) dd6fcf1 WIP KIT-T984: shell-source-write doc (implements KIT-T984)
- [2026-11-11 02:57] (landed) dc894af WIP KIT-T984: gate judges every hit, lifts only a proven destination outside the repo (implements KIT-T984)
- [2026-11-11 02:58] (landed) 341a1d8 WIP KIT-T984: option values judged as operands (implements KIT-T984)
- [2026-11-11 02:58] (landed) 79de45f WIP KIT-T984: dash variants and non-ASCII are options and impure; landing names under a directory destination (implement
- [2026-11-11 02:59] (landed) f5424e9 WIP KIT-T984: an untagged copy also judges the names under its destination (implements KIT-T984)
- [2026-11-11 03:01] (landed) c9437ba WIP KIT-T984: table-driven fail-closed copy tests (implements KIT-T984)
- [2026-11-11 03:04] (comment) @claude: Security pass (review findings): copies and moves now use a strict allowlist. hooks/lib/shell-copy-target.mjs proves a d (full comment #2 in ## Notes)
### comment #2 [2026-11-11 03:04] @claude
Security pass (review findings): copies and moves now use a strict allowlist. hooks/lib/shell-copy-target.mjs proves a destination only for cp/mv/Copy-Item/Move-Item with plain literal tokens (no glob, variable, substitution, brace, unquoted backslash, backtick, comma, non-ASCII), options limited to -f -p -v -n (mv: -f -v -n; PowerShell: -Path -Destination -Force exact) plus exact -t/--target-directory forms, one source and one destination. source-shell-gate collects EVERY hit (scanAllShellWrites/shellSourceWrites) and lifts only a proven source operand whose destination resolves outside the hit's repo by realpath/relative and is no existing directory (hooks/lib/lands-outside-repo.mjs); one proven move never excuses the rest of the line. Everything else judges every operand, glued option values and <operand>/any.rs. Dash variants U+2013/2014/2015 are options. Tests: hooks/shell-copy-target.test.mjs, 77 cases through the real gate; loosening the allowlist (-r/-s/-R/-a) fails 4. Deliberate false positives: in-repo backups (cp a.cpp a.cpp.bak), install, abbreviated PowerShell parameters (-dest), destination named as an existing directory, several sources.
