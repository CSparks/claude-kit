---
id: KIT-T382
title: q show cannot resolve an RG-INBOX id that q fts lists (DE-T071 audit); and the rapid-game inbox capture 2026-10-06-1647 (air control) landed
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T922
created: 2026-10-07T03:46:26Z
updated: 2026-10-07T03:46:26Z
---

## Description
q show cannot resolve an RG-INBOX id that q fts lists (DE-T071 audit); and the rapid-game inbox capture 2026-10-06-1647 (air control) landed under D:/dev/stiletto-2349/rapid-game/.ai/inbox, not the rapid-game project store — cap --project rapid-game resolved to a submodule checkout's .ai

kit-bug-shape: cap:bug:q-show-cannot-resolve-an-rg-inbox-id-that-q-fts-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 03:46] (created) bug — q show cannot resolve an RG-INBOX id that q fts lists (DE-T071 audit); and the rapid-game inbox capture 2026-10-06-1647 (air control) landed
- [2026-11-09 23:33] (status) todo → superseded (by KIT-T922)
- [2026-11-09 23:33] (comment) @kit-agent: Duplicate of KIT-T922: q show now resolves the synthetic <KEY>-INBOX/-QUESTIONS ids the cache lists (full id or prefix).
- [2026-11-09 23:33] (comment) @kit-agent: Not covered by KIT-T922: the second half (cap --project rapid-game wrote the capture under the stiletto-2349 submodule checkout's .ai, not the rapid-game project store) is a separate defect.
