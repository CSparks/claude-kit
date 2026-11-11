---
id: KIT-T1016
title: source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:40:32Z
updated: 2026-11-11T04:40:32Z
---

## Description
source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/zz-repro.test.mjs): a deletion leaves nothing for pre-write to judge and hand-write-detect already counts a deleted path as no write, so the gate should let rm of a source path pass; also prevention for process failures 1-2 (agent wrote a repro via a bash heredoc, then a node one-liner naming the file): the block text should say 'use the Write tool' with the Write form first

kit-bug-shape: cap:bug:source-shell-gate-source-shell-write-blocks-an-r
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:40] (created) bug — source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/
- [2026-11-11 04:40] (comment) seen again in claude-kit: source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (scratch repro): deletion leaves nothing for pre-write to judge
- [2026-11-11 04:40] (asked again) 2026-11-11 — cap:bug:source-shell-gate-source-shell-write-blocks-an-r
