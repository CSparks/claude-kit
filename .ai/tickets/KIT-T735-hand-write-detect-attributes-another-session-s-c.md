---
id: KIT-T735
title: hand-write-detect attributes another session's concurrent edits to the current session: with two writers in one checkout, a read-only shell
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T21:56:24Z
updated: 2026-10-30T22:08:31Z
---

## Description
hand-write-detect attributes another session's concurrent edits to the current session: with two writers in one checkout, a read-only shell call (git status) was blamed for scripts/broker/alias.mjs, cargo-lock.mjs and alias-closure.test.mjs that the other session's Edit/Write changed between this call's pre and post snapshots; the ledger then holds files this session never wrote. Seen 2026-10-30.

kit-bug-shape: cap:bug:hand-write-detect-attributes-another-session-s-c
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed for read-only commands: handWrittenSources treats a pipeline of readers (cat/grep/head/ls/echo...) with no file redirect like a generator, so a change another session lands meanwhile is not attributed. Limit: an interpreter call (node script.mjs) can still be blamed for a concurrent edit; mtime windows cannot separate them, so that stays. Evidence: hooks/hand-write-detect.test.mjs 34 passed (two negative controls, redirect controls).

## History
- [2026-10-30 21:56] (created) bug — hand-write-detect attributes another session's concurrent edits to the current session: with two writers in one checkout, a read-only shell
- [2026-10-30 22:08] (status) todo → review
- [2026-10-30 22:08] (landed) eb53d21 hand-write-detect: a read-only command (cat, grep, head, git, npm) is never blamed for another writer's edits; implement
