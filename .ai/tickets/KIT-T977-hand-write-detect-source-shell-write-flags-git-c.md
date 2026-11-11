---
id: KIT-T977
title: hand-write-detect (source-shell-write) flags 'git checkout -- <file>' as a hand write of source, though a git restore is a revert not a hand
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T982
created: 2026-11-10T20:58:14Z
updated: 2026-11-10T20:58:14Z
---

## Description
hand-write-detect (source-shell-write) flags 'git checkout -- <file>' as a hand write of source, though a git restore is a revert not a hand edit; orchestrator briefs tell agents to revert mutation checks with git checkout. Forced a no-op Edit re-save of src/generator/roles/PercussionAssignment.cpp (GG-T202 session)

kit-bug-shape: cap:bug:hand-write-detect-source-shell-write-flags-git-c
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 20:58] (created) bug — hand-write-detect (source-shell-write) flags 'git checkout -- <file>' as a hand write of source, though a git restore is a revert not a hand
- [2026-11-11 02:21] (status) todo → superseded (by KIT-T982)
