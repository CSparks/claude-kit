---
id: KIT-T417
title: dispatch-guard foreign-tree-edits inferred the agent's tree from a path MENTIONED in the prompt (D:/dev/stiletto-2349/rapid-game, named as a
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T15:04:34Z
updated: 2026-10-10T15:04:34Z
---

## Description
dispatch-guard foreign-tree-edits inferred the agent's tree from a path MENTIONED in the prompt (D:/dev/stiletto-2349/rapid-game, named as a fetch-only sibling) instead of the cwd or an explicit [tree:] token, and blocked a dirt-empire writer for stiletto's rg-screens edits (2026-10-10). The tree is cwd unless [tree:] says otherwise; a bare path in prose is not a declaration

kit-bug-shape: cap:bug:dispatch-guard-foreign-tree-edits-inferred-the-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 15:04] (created) bug — dispatch-guard foreign-tree-edits inferred the agent's tree from a path MENTIONED in the prompt (D:/dev/stiletto-2349/rapid-game, named as a
