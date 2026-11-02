---
id: KIT-T827
title: successor gate / reconciler names a reopen (SendMessage) for an agent that is not resumable in this session (No transcript found for agent I
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:10Z
updated: 2026-11-02T17:02:34Z
---

## Description
successor gate / reconciler names a reopen (SendMessage) for an agent that is not resumable in this session (No transcript found for agent ID); a landed result with its sha on main should auto-ack, else dispatch a fresh worker

kit-bug-shape: cap:bug:successor-gate-reconciler-names-a-reopen-sendmes
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: published as runtime 6b1d621 (npm run publish:runtime at HEAD 6b1d621, 137 of 329 files green in 107 s wall at 8 workers, 2m53s total); fix commits 0f59f85 b5787a2 0302076; tests runtime-publish 31, runner 16, housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4

## History
- [2026-11-02 16:33] (created) bug — successor gate / reconciler names a reopen (SendMessage) for an agent that is not resumable in this session (No transcript found for agent I
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 16:58] (comment) @claude: @kit-agent: claimed by the standing kit agent; fixed in 0f59f85, publishing now, will move to review with the test evidence when green
- [2026-11-02 17:02] (status) todo → review
- [2026-11-02 17:02] (landed) ca1b44d KIT-T823..T828 to review after runtime 6b1d621 published, 137 files green [no-test: ticket store only] (implements KIT-T
