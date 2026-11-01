---
id: KIT-T664
title: q code --path <dir> run from a registered submodule checkout (D:/dev/dirt-empire/rapid-game) returns 'no indexed file passes --path rust' —
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T05:46:58Z
updated: 2026-10-28T05:46:58Z
---

## Description
q code --path <dir> run from a registered submodule checkout (D:/dev/dirt-empire/rapid-game) returns 'no indexed file passes --path rust' — paths are relative to the superproject, so the submodule-relative path the agent naturally types matches nothing. Root cause: q resolves --path against the superproject root, not the cwd's repo.

kit-bug-shape: cap:bug:q-code-path-dir-run-from-a-registered-submodule-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 05:47] (created) bug — q code --path <dir> run from a registered submodule checkout (D:/dev/dirt-empire/rapid-game) returns 'no indexed file passes --path rust' —
