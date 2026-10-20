---
id: KIT-T547
title: dispatch-guard (KIT-T432) picks the tech-debt default job for a brief whose work tickets are bugs: a sonnet patch-worker brief fixing RG-T21
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T19:26:53Z
updated: 2026-10-16T21:02:55Z
fixed_commit: 15da5cf
---

## Description
dispatch-guard (KIT-T432) picks the tech-debt default job for a brief whose work tickets are bugs: a sonnet patch-worker brief fixing RG-T213 + RG-T215 (both type bug) that also cites the vetting ticket ST-T904 (tech-debt) is blocked as 'fix outranks chore for tech-debt', even with [job: fix] and the bug ids first. Expected: the job type comes from the tickets the brief works (or the highest-ranked), not a context citation. Seen stiletto-2349-2a 2026-10-16.

kit-bug-shape: cap:bug:dispatch-guard-kit-t432-picks-the-tech-debt-defa
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 19:26] (created) bug — dispatch-guard (KIT-T432) picks the tech-debt default job for a brief whose work tickets are bugs: a sonnet patch-worker brief fixing RG-T21
- [2026-10-16 21:02] (comment) @claude: fixed 15da5cf: the cause was that the bug ids (RG-T213/RG-T215) live in the rapid-game submodule's .ai store, which the  (full comment #1 in ## Notes)
### comment #1 [2026-10-16 21:02] @claude
fixed 15da5cf: the cause was that the bug ids (RG-T213/RG-T215) live in the rapid-game submodule's .ai store, which the gate never searched, so only the cited ST-T904 (tech-debt) was typed and fix outranked chore. hooks/dispatch-escalation.mjs ticketTypes now also reads the stores of every submodule in .gitmodules, and an id found nowhere counts as the catch-all type when other ids in the brief were typed (a lone unknown id still imposes nothing). Evidence: hooks/dispatch-guard.test.mjs, the brief shape RG-T213/RG-T215 + cited ST-T904 with [job: fix] passes with the tickets in the submodule store and with them in no store (both red before: exit 2), controls: a fix job on a brief naming only ST-T904 still blocks, an opus build on that brief still blocks.
- [2026-10-16 21:02] (status) todo → review
- [2026-10-16 21:02] (comment) hooks/dispatch-guard.test.mjs, 2 checks red before
