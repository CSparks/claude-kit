---
id: KIT-T521
title: DATA LOSS: 't session "<text>"' (KIT-T509 verb, d008eaa) REPLACED the whole .ai/SESSION.md with the one line given ('session: .ai/SESSION.md
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:43:59Z
updated: 2026-10-15T18:02:12Z
---

## Description
DATA LOSS: 't session "<text>"' (KIT-T509 verb, d008eaa) REPLACED the whole .ai/SESSION.md with the one line given ('session: .ai/SESSION.md written (1 lines)'), wiping the resume anchor and the dated FRAMEWORK PROGRAMME log the flush hook told the operator to flush with exactly that command (flush.mjs: 'Flush the anchor with t session "<state + next steps>"'). The verb must update the anchor block (first line / Current state / Next steps) and keep the rest, or refuse when the file has content it does not model; and it must write a backup (.ai/SESSION.md.bak or git stash of the file) before any full rewrite. Operator is rebuilding from git HEAD plus the session transcript (stiletto-2349-68, 2026-10-15 13:22) --priority high

kit-bug-shape: cap:bug:data-loss-t-session-text-kit-t509-verb-d008eaa-r
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 17:43] (created) bug — DATA LOSS: 't session "<text>"' (KIT-T509 verb, d008eaa) REPLACED the whole .ai/SESSION.md with the one line given ('session: .ai/SESSION.md
- [2026-10-15 18:02] (comment) @claude: Fixed in a3aa622 (pushed). t session default now inserts a dated line under the anchor's top section and deletes nothing (full comment #1 in ## Notes)
### comment #1 [2026-10-15 18:02] @claude
Fixed in a3aa622 (pushed). t session default now inserts a dated line under the anchor's top section and deletes nothing; --replace needs --file; every write backs the previous SESSION.md up to .ai/.session-backups (last 20, folder self-ignored); flush hook text names the safe form. Tests: t-verbs 13 passed (plain text keeps every prior line, --replace without --file refused, backup after each write, overwrite negative control, CLI exit 2), flush 19 passed, t 109 passed, t-decide 4 passed. Full npm test run pending with the broker tickets.
- [2026-10-15 18:02] (status) todo → review
