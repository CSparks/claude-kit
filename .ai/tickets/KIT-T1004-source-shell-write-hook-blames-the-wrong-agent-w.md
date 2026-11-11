---
id: KIT-T1004
title: source-shell-write hook blames the wrong agent when several agents write one checkout: a gradle call by agent A is flagged for files agent B
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:58:07Z
updated: 2026-11-11T03:58:07Z
---

## Description
source-shell-write hook blames the wrong agent when several agents write one checkout: a gradle call by agent A is flagged for files agent B edited via Edit/Write (OverlayContentBuilderTest.kt, HomeCaptionsTest.kt, AlbumYears.kt in a parallel UI build). Related KIT-T849/T953.

kit-bug-shape: cap:bug:source-shell-write-hook-blames-the-wrong-agent-w
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:58] (created) bug — source-shell-write hook blames the wrong agent when several agents write one checkout: a gradle call by agent A is flagged for files agent B
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
