---
id: KIT-T811
title: dispatch-guard let marblequest-18 dispatch a claude-kit writer (14:5x-16:10, 2026-11-01) while infra-09's standing kit agent held the checko
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T22:26:49Z
updated: 2026-11-01T22:53:38Z
---

## Description
dispatch-guard let marblequest-18 dispatch a claude-kit writer (14:5x-16:10, 2026-11-01) while infra-09's standing kit agent held the checkout (KIT-D123). Root cause: the guard checks only uncommitted foreign edits in the tree, not a live writer registered by another session, so an idle-tree moment lets a second writer in. Fix: the guard reads the live kit-holder (the KIT-D123 hand-off registry or the agents roster across sessions) and blocks a claude-kit writer dispatch from any other session, pointing at SendMessage to the holder.

kit-bug-shape: cap:bug:dispatch-guard-let-marblequest-18-dispatch-a-cla
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 4266fd3. Machine-wide holder registry hooks/lib/checkout-holder.mjs keyed by checkout path and session; holder-beat.mjs (PreToolUse Write|Edit) heartbeats, dispatch-guard registers an allowed writer dispatch and blocks another session's writer dispatch (check-id checkout-holder, message names the holder session and says SendMessage with full KIT-T ids, KIT-D123); agent-roster releases on SubagentStop or a synchronous writer finishing; 15 min silent = stale. Tests: hooks/dispatch-guard.test.mjs 187 passed (two simulated sessions: block, holder's own agent passes, read-only and [read-only:] pass, stale holder passes, stop releases), agent-roster 47, plugin-compat 139 passed.

## History
- [2026-11-01 22:26] (created) bug — dispatch-guard let marblequest-18 dispatch a claude-kit writer (14:5x-16:10, 2026-11-01) while infra-09's standing kit agent held the checko
- [2026-11-01 22:27] (status) todo → doing
- [2026-11-01 22:53] (landed) 4266fd3 dispatch-guard: a writer dispatch into a checkout another session holds with a live writer is blocked; the machine-wide
- [2026-11-01 22:53] (status) doing → review
