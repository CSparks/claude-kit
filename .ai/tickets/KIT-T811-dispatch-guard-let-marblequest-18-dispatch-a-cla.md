---
id: KIT-T811
title: dispatch-guard let marblequest-18 dispatch a claude-kit writer (14:5x-16:10, 2026-11-01) while infra-09's standing kit agent held the checko
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T22:26:49Z
updated: 2026-11-01T22:27:20Z
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

## History
- [2026-11-01 22:26] (created) bug — dispatch-guard let marblequest-18 dispatch a claude-kit writer (14:5x-16:10, 2026-11-01) while infra-09's standing kit agent held the checko
- [2026-11-01 22:27] (status) todo → doing
