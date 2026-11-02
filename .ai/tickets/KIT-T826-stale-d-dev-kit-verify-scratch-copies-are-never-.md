---
id: KIT-T826
title: stale D:/dev/.kit-verify-* scratch copies are never removed (8 present), stopProcessesUnder never matched Windows paths (JSON-escaped backsl
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:08Z
updated: 2026-11-02T17:02:29Z
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

## Notes
Evidence: published as runtime 6b1d621 (npm run publish:runtime at HEAD 6b1d621, 137 of 329 files green in 107 s wall at 8 workers, 2m53s total); fix commits 0f59f85 b5787a2 0302076; tests runtime-publish 31, runner 16, housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4

## History
- [2026-11-02 16:33] (created) bug — stale D:/dev/.kit-verify-* scratch copies are never removed (8 present), stopProcessesUnder never matched Windows paths (JSON-escaped backsl
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 16:49] (landed) b5787a2 Test runner: a file is done when its process exits (a daemon holding stdout no longer blocks a worker or records minutes
- [2026-11-02 17:02] (status) todo → review
