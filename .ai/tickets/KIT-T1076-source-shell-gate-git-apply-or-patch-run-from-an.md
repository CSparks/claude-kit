---
id: KIT-T1076
title: source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T19:44:29Z
updated: 2026-11-11T19:44:29Z
---

## Description
source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap string, echo of a command substitution holding git apply with a heredoc diff); only a segment-leading applier is judged, ambiguous lines block them. Found KIT-T1075, pass before and after.

kit-bug-shape: cap:bug:source-shell-gate-git-apply-or-patch-run-from-an
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 19:44] (created) bug — source-shell-gate: git apply or patch run from another command passes in an unambiguous line (find -exec git apply, ssh host git apply, trap
