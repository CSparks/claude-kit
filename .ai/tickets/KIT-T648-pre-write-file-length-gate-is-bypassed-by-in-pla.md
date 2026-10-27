---
id: KIT-T648
title: pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines,
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T14:34:39Z
updated: 2026-10-27T14:34:39Z
---

## Description
pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines, via node before hitting the gate on Edit, 2026-10-27; reverted). Root cause: the gate hooks only Edit/Write, so a scripted write skips it

kit-bug-shape: cap:bug:pre-write-file-length-gate-is-bypassed-by-in-pla
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 14:34] (created) bug — pre-write file-length gate is bypassed by in-place edits made with node/shell (an implementer edited rapid-game shader_kit.wgsl, 617 lines,
- [2026-10-27 15:51] (comment) @claude: Recurred 2026-10-27 in dirt-empire DE-T183: an implementer made two more shell in-place source edits (rg-model slot.rs 4 (full comment #1 in ## Notes)
### comment #1 [2026-10-27 15:51] @claude
Recurred 2026-10-27 in dirt-empire DE-T183: an implementer made two more shell in-place source edits (rg-model slot.rs 4 lines; sed on imported_asset.rs, landed in rapid-game 2d9b7f1) despite a brief instruction to use Edit/Write only. A brief line does not hold; this needs the gate.
