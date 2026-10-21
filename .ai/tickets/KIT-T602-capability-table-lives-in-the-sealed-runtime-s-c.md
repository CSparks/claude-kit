---
id: KIT-T602
title: capability table lives in the sealed runtime's copy of .ai/config.yml, so a re-date (data) needs a full publish:runtime (20+ min) before dis
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T05:07:20Z
updated: 2026-10-21T05:07:20Z
---

## Description
capability table lives in the sealed runtime's copy of .ai/config.yml, so a re-date (data) needs a full publish:runtime (20+ min) before dispatch-guard sees it; a stale row blocks every dispatch meanwhile. Read the table from the kit checkout (data), keep code sealed. First hit 2026-10-21, asset row re-date

kit-bug-shape: cap:bug:capability-table-lives-in-the-sealed-runtime-s-c
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 05:07] (created) bug — capability table lives in the sealed runtime's copy of .ai/config.yml, so a re-date (data) needs a full publish:runtime (20+ min) before dis
