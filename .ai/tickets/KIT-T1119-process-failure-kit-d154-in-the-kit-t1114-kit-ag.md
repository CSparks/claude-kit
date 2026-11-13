---
id: KIT-T1119
title: process failure (KIT-D154) in the KIT-T1114 kit agent run: twice a source file was written through a node -e script (hooks/dispatch-guard.mj
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T05:45:11Z
updated: 2026-11-13T05:45:11Z
---

## Description
process failure (KIT-D154) in the KIT-T1114 kit agent run: twice a source file was written through a node -e script (hooks/dispatch-guard.mjs, hooks/build-write-hold.test.mjs) and the source-shell-write gate refused both; root cause: the reflex to script a multi-part edit instead of several Edit calls; prevention: agents/implementer.md Discipline says source edits go only through Edit/Write, never node -e, a heredoc or a shell redirect on a repo path

kit-bug-shape: cap:bug:process-failure-kit-d154-in-the-kit-t1114-kit-ag
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-13 05:45] (created) bug — process failure (KIT-D154) in the KIT-T1114 kit agent run: twice a source file was written through a node -e script (hooks/dispatch-guard.mj
