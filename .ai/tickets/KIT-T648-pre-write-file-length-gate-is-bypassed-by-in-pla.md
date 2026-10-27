---
id: KIT-T648
title: pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines,
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T14:34:39Z
updated: 2026-10-27T21:47:01Z
---

## Description
pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines, via node before hitting the gate on Edit, 2026-10-27; reverted). Root cause: the gate hooks only Edit/Write, so a scripted write skips it

kit-bug-shape: cap:bug:pre-write-file-length-gate-is-bypassed-by-in-pla
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A shell command that writes a source file is blocked before it runs and names Edit/Write

## Plan
1.

## Notes
2026-10-27 New PreToolUse gate hooks/source-shell-gate.mjs (check-id source-shell-write) blocks a shell write of a source file (redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlets, node -e / python -c, node heredoc, temp-dir scratch script) and points at Edit/Write, so pre-write's length, comment and literal checks are not bypassed. Temp dir, target/ node_modules/ dist/ build/, data files, git and kit verbs pass; exclusion via .claude-kit-ignore.yaml source-shell-write. Engine shared with store-shell-gate (new hooks/lib/shell-write-scan.mjs; store-shell-write.mjs now a policy over it, and perl -i now also guards the store). Registered in hooks/hooks.json, documented in hooks/README.md. Tests: hooks/source-shell-gate.test.mjs 40 passed (14 blocked shapes, 18 allowed shapes incl. negative controls, scratch script, exclusion, fail-open), store-shell-gate 29, pre-write 36, compat-run 12, plugin-compat 121, python-stdin-gate 18, tree-delete-gate 12. Not covered: a command that builds the source path at runtime without a quoted source literal. A publish ships this gate to every session: an implementer's sed -i / node-written source edit is then refused, including in other projects, so expect first-day friction and tell implementers to use Edit/Write.

## History
- [2026-10-27 14:34] (created) bug — pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines,
- [2026-10-27 15:51] (comment) @claude: Recurred 2026-10-27 in dirt-empire DE-T183: an implementer made two more shell in-place source edits (rg-model slot.rs 4 (full comment #1 in ## Notes)
### comment #1 [2026-10-27 15:51] @claude
Recurred 2026-10-27 in dirt-empire DE-T183: an implementer made two more shell in-place source edits (rg-model slot.rs 4 lines; sed on imported_asset.rs, landed in rapid-game 2d9b7f1) despite a brief instruction to use Edit/Write only. A brief line does not hold; this needs the gate.
- [2026-10-27 21:46] (comment) criterion added: A shell command that writes a source file is blocked before it runs and names Edit/Write
- [2026-10-27 21:46] (comment) ticked: A shell command that writes a source file is blocked before it runs and names Edit/Write
- [2026-10-27 21:47] (status) todo → review
