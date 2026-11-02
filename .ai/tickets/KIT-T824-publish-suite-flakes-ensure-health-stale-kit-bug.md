---
id: KIT-T824
title: publish suite 'flakes' (ensure, health-stale, kit-bug, landgate-conformance, gate, worktree-guard, liveness pass alone, FAIL in the suite) a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:05Z
updated: 2026-11-02T17:02:20Z
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

## Notes
Evidence: published as runtime 6b1d621 (npm run publish:runtime at HEAD 6b1d621, 137 of 329 files green in 107 s wall at 8 workers, 2m53s total); fix commits 0f59f85 b5787a2 0302076; tests runtime-publish 31, runner 16, housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4

## History
- [2026-11-02 16:33] (created) bug — publish suite 'flakes' (ensure, health-stale, kit-bug, landgate-conformance, gate, worktree-guard, liveness pass alone, FAIL in the suite) a
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 16:49] (landed) b5787a2 Test runner: a file is done when its process exits (a daemon holding stdout no longer blocks a worker or records minutes
- [2026-11-02 16:57] (landed) 0302076 Test fixes from the export run: runner tests ignore the publish's own env, control.test matches a landing line not the l
- [2026-11-02 17:02] (status) todo → review
- [2026-11-02 17:02] (landed) ca1b44d KIT-T823..T828 to review after runtime 6b1d621 published, 137 files green [no-test: ticket store only] (implements KIT-T
