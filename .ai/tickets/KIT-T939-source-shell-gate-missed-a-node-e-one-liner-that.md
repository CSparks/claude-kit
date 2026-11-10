---
id: KIT-T939
title: source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T16:41:05Z
updated: 2026-11-10T16:41:05Z
---

## Description
source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed ungated; the same shape against scripts/t-decide.mjs one call later was blocked). Found while fixing KIT-T938; process failure on my side (hand-wrote source via shell), gate miss on the first call.

kit-bug-shape: cap:bug:source-shell-gate-missed-a-node-e-one-liner-that
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 16:41] (created) bug — source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed
