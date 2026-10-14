---
id: KIT-T440
title: Broker labels a DIRTY baseline 'clean committed tree': the 36 RG-T146..T184 tickets say 'fails on a clean committed tree' while every target
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T02:53:29Z
updated: 2026-10-13T02:53:29Z
---

## Description
Broker labels a DIRTY baseline 'clean committed tree': the 36 RG-T146..T184 tickets say 'fails on a clean committed tree' while every target/broker/deferred.json entry records Chris's 12 uncommitted .rhai files under 'dirty'; three of those failures (scrap golden, gusset, profile_preview) are caused by the dirty files. The auto-filed ticket text must say 'baseline with N dirty files: <list>' when the tree is not clean, and the ticket should land in the store of the test's package (stiletto tests were filed in the rapid-game store because the command ran from rapid-game).

kit-bug-shape: cap:bug:broker-labels-a-dirty-baseline-clean-committed-t
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 02:53] (created) bug — Broker labels a DIRTY baseline 'clean committed tree': the 36 RG-T146..T184 tickets say 'fails on a clean committed tree' while every target
