---
id: KIT-T828
title: deadlock: successor gate demands a patch-worker successor that dispatch-guard refuses on [paths: *] overlap with an in-flight worker; a bloc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:12Z
updated: 2026-11-02T17:02:38Z
---

## Description
deadlock: successor gate demands a patch-worker successor that dispatch-guard refuses on [paths: *] overlap with an in-flight worker; a blocked-only-by-paths dispatch must be QUEUED behind the blocker and satisfy the gate until the blocker ends

kit-bug-shape: cap:bug:deadlock-successor-gate-demands-a-patch-worker-s
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: published as runtime 6b1d621 (npm run publish:runtime at HEAD 6b1d621, 137 of 329 files green in 107 s wall at 8 workers, 2m53s total); fix commits 0f59f85 b5787a2 0302076; tests runtime-publish 31, runner 16, housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4

## History
- [2026-11-02 16:33] (created) bug — deadlock: successor gate demands a patch-worker successor that dispatch-guard refuses on [paths: *] overlap with an in-flight worker; a bloc
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 17:02] (status) todo → review
