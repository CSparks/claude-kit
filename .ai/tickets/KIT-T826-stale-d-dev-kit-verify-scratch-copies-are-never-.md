---
id: KIT-T826
title: stale D:/dev/.kit-verify-* scratch copies are never removed (8 present), stopProcessesUnder never matched Windows paths (JSON-escaped backsl
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:08Z
updated: 2026-11-02T16:33:08Z
---

## Description
stale D:/dev/.kit-verify-* scratch copies are never removed (8 present), stopProcessesUnder never matched Windows paths (JSON-escaped backslashes); sweep at publish end, publish start and session start; publish must finish under the ceiling

kit-bug-shape: cap:bug:stale-d-dev-kit-verify-scratch-copies-are-never-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 16:33] (created) bug — stale D:/dev/.kit-verify-* scratch copies are never removed (8 present), stopProcessesUnder never matched Windows paths (JSON-escaped backsl
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 16:49] (landed) b5787a2 Test runner: a file is done when its process exits (a daemon holding stdout no longer blocks a worker or records minutes
