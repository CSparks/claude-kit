---
id: KIT-T1003
title: source-shell-write hook (KIT-T706) blames the wrong agent when several agents write one checkout: a gradle/shell call by agent A is flagged
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:57:59Z
updated: 2026-11-11T03:57:59Z
---

## Description
source-shell-write hook (KIT-T706) blames the wrong agent when several agents write one checkout: a gradle/shell call by agent A is flagged for files agent B edited via Edit/Write (seen on OverlayContentBuilderTest.kt, OverlayContentSources.kt, HomeCaptionsTest.kt, AlbumYears.kt during a parallel UI build). It should diff only changes made during that shell call by that session, or ignore files touched by Edit/Write of any session.

kit-bug-shape: cap:bug:source-shell-write-hook-kit-t706-blames-the-wron
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:57] (created) bug — source-shell-write hook (KIT-T706) blames the wrong agent when several agents write one checkout: a gradle/shell call by agent A is flagged
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
