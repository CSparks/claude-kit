---
id: KIT-T824
title: publish suite 'flakes' (ensure, health-stale, kit-bug, landgate-conformance, gate, worktree-guard, liveness pass alone, FAIL in the suite) a
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:05Z
updated: 2026-11-02T16:33:05Z
---

## Description
publish suite 'flakes' (ensure, health-stale, kit-bug, landgate-conformance, gate, worktree-guard, liveness pass alone, FAIL in the suite) are the in-flight files of a publish killed at the harness 180 s window, not flakes; the suite must fit the window

kit-bug-shape: cap:bug:publish-suite-flakes-ensure-health-stale-kit-bug
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 16:33] (created) bug — publish suite 'flakes' (ensure, health-stale, kit-bug, landgate-conformance, gate, worktree-guard, liveness pass alone, FAIL in the suite) a
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 16:49] (landed) b5787a2 Test runner: a file is done when its process exits (a daemon holding stdout no longer blocks a worker or records minutes
- [2026-11-02 16:57] (landed) 0302076 Test fixes from the export run: runner tests ignore the publish's own env, control.test matches a landing line not the l
