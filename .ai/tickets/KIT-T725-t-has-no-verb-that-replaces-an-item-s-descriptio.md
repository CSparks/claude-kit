---
id: KIT-T725
title: t has no verb that replaces an item's Description or Plan, so under KIT-D120 (gate refuses hand Edit of an existing .ai item) the only path
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T04:35:52Z
updated: 2026-10-30T04:37:56Z
fixed_commit: 616f14d
---

## Description
t has no verb that replaces an item's Description or Plan, so under KIT-D120 (gate refuses hand Edit of an existing .ai item) the only path is a hand edit; add t edit <id> --section Description|Plan|Notes --file <path>, atomic, with a History line (found landing KIT-T723)

kit-bug-shape: cap:bug:t-has-no-verb-that-replaces-an-item-s-descriptio
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-30 04:35] (created) bug — t has no verb that replaces an item's Description or Plan, so under KIT-D120 (gate refuses hand Edit of an existing .ai item) the only path
- [2026-10-30 04:37] (landed) 616f14d t edit replaces one Description/Plan/Notes section from a file and stamps History; files KIT-T725 and records KIT-D120 (
- [2026-10-30 04:37] (status) todo → review
- [2026-10-30 04:37] (comment) t edit landed in 616f14d; gate hint in eaab6bb
