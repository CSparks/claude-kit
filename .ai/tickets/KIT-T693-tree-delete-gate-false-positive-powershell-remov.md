---
id: KIT-T693
title: tree-delete-gate false positive: PowerShell 'Remove-Item Env:CARGO_TARGET_DIR' (removing an environment variable, not a file) is blocked as
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T00:30:45Z
updated: 2026-10-29T00:30:45Z
---

## Description
tree-delete-gate false positive: PowerShell 'Remove-Item Env:CARGO_TARGET_DIR' (removing an environment variable, not a file) is blocked as a shell delete inside a broker-owned checkout

kit-bug-shape: cap:bug:tree-delete-gate-false-positive-powershell-remov
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 00:30] (created) bug — tree-delete-gate false positive: PowerShell 'Remove-Item Env:CARGO_TARGET_DIR' (removing an environment variable, not a file) is blocked as
