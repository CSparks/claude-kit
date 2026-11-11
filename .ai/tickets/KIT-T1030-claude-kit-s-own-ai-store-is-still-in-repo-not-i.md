---
id: KIT-T1030
title: claude-kit's own .ai store is still in-repo, not in claude-kit-data (violates KIT-D016): 2026-11-11 the kit checkout had 428 uncommitted fil
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:59:35Z
updated: 2026-11-11T06:59:35Z
---

## Description
claude-kit's own .ai store is still in-repo, not in claude-kit-data (violates KIT-D016): 2026-11-11 the kit checkout had 428 uncommitted files, 396 tickets (112 unstaged renames, ~100 never-committed new, ~73 edited) and 17 never-committed decisions KIT-D131..D157 on one disk only. Store writes from other sessions never pass a commit path. Move the store to claude-kit-data/projects/claude-kit with history kept, link it like every project, commit+push the backlog first. Maintainer 2026-11-11: 'That should all be living in claude-kit-data and it should NOT be falling behind on commits/pushes.'

Checked as possible duplicates and judged different work (--not-dup): KIT-T892, KIT-T160, KIT-T134

kit-bug-shape: cap:bug:claude-kit-s-own-ai-store-is-still-in-repo-not-i
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:59] (created) bug — claude-kit's own .ai store is still in-repo, not in claude-kit-data (violates KIT-D016): 2026-11-11 the kit checkout had 428 uncommitted fil
