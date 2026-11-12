---
id: KIT-T1099
title: pre-write hook blocks an Edit of an existing ticket's Notes prose (store-write, KIT-D120) while the project contract and the t-verb table sa
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T18:10:35Z
updated: 2026-11-12T18:23:05Z
---

## Description
pre-write hook blocks an Edit of an existing ticket's Notes prose (store-write, KIT-D120) while the project contract and the t-verb table say an Edit of existing item prose stays allowed (KIT-D037); one of the two is wrong

kit-bug-shape: cap:bug:pre-write-hook-blocks-an-edit-of-an-existing-tic
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Diagnosis: the hook is right, the contract text was stale. KIT-D120 (Chris 2026-10-30: edited through KIT, not by hand) supersedes the KIT-D037 reading; hooks/lib/store-write-gate.mjs ITEM_VERBS refuses a hand Edit/Write of any existing item and names t notes (append) and t edit --section Description|Plan|Notes --file (replace). Fixed the contract text in CLAUDE.md and project-template/CLAUDE.snippet.md (project copies, e.g. road-generator CLAUDE.md, still carry the old line until re-synced from the snippet). Tests: hooks/store-write-gate.test.mjs 44 passed (new: a Notes-confined Edit of an existing ticket is refused naming both verbs; both contract copies say refused, never stays allowed). Commit 7cac612.

## History
- [2026-11-12 18:10] (created) bug — pre-write hook blocks an Edit of an existing ticket's Notes prose (store-write, KIT-D120) while the project contract and the t-verb table sa
- [2026-11-12 18:16] (landed) 7cac612 contract text: a hand Edit of an existing .ai item is refused (KIT-D120), t notes appends and t edit --section replaces;
- [2026-11-12 18:23] (status) todo → review
