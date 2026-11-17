---
id: KIT-T1354
title: commit-log gate blocks 'git commit --amend --no-edit' as 'no ticket citation' though the kept message cites one (RDG-D110); it reads only th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T21:44:50Z
updated: 2026-11-17T21:50:45Z
---

## Description
commit-log gate blocks 'git commit --amend --no-edit' as 'no ticket citation' though the kept message cites one (RDG-D110); it reads only the command text, not the amended message

kit-bug-shape: cap:bug:commit-log-gate-blocks-git-commit-amend-no-edit-:87d11497
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: the gate judged the command text plus a -F file (KIT-T1019) but not a kept message. hooks/lib/commit-message.mjs commitMessageText now returns the message a bare --amend keeps (HEAD) or -C/-c/--reuse-message/--reedit-message names; a new -m/-F message replaces it. Tests: hooks/commit-gate-reused-message.test.mjs 8 passed (cited amend passes, uncited amend blocks, -F cited passes, -m replacement of a cited HEAD blocks); commit-gate 42, commit-gate-git-call 29, commit-gate-message-file 20, commit-message-files 22, commit-message-owner 8, commit-cite-keys 8.

## History
- [2026-11-17 21:44] (created) bug — commit-log gate blocks 'git commit --amend --no-edit' as 'no ticket citation' though the kept message cites one (RDG-D110); it reads only th
- [2026-11-17 21:50] (status) todo → review
