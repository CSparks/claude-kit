---
id: KIT-T892
title: claude-kit-data sync only commits the stopping session's project subtree: 110 files never committed, unbounded/.ai last committed 2026-10-06
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T16:35:32Z
updated: 2026-11-08T16:35:32Z
---

## Description
claude-kit-data sync only commits the stopping session's project subtree: 110 files never committed, unbounded/.ai last committed 2026-10-06 (UNB-T039..T050 exist on one disk only), showtimewarp 36 files since 10-16, overlay/CLAUDE.md since 10-22. Ordinary store files, should have been swept. Needs a whole-repo sweep (all projects + unbounded + overlay) on every sync. Maintainer 2026-11-08: 'That sounds like a problem that shouldn't be happening. Especially if they look like run-of-the-mill files for this repo.'

kit-bug-shape: cap:bug:claude-kit-data-sync-only-commits-the-stopping-s
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-08 16:35] (created) bug — claude-kit-data sync only commits the stopping session's project subtree: 110 files never committed, unbounded/.ai last committed 2026-10-06
- [2026-11-08 16:42] (comment) @claude: Root cause (read-only analyst, 2026-11-08): hooks/sync-data.mjs:11-12 exits with no git root (unbounded sessions in ~ ne (full comment #1 in ## Notes)
### comment #1 [2026-11-08 16:42] @claude
Root cause (read-only analyst, 2026-11-08): hooks/sync-data.mjs:11-12 exits with no git root (unbounded sessions in ~ never sync); :16-17 exits unless .ai is a junction; :23,31,69-71 stage+commit only projects/<name>; no path covers overlay/ or unbounded/. Cross-project writes (one 2026-10-21 context-budget item landed in autoaudit AUT-T059, marblerace2 MGP-T025, showtimewarp STW-T038) strand in dormant stores until their next Stop, which never comes. Scoping came from KIT-T230 (720b38d), and commit-gate now blocks a multi-subtree commit, so a manual sweep is also blocked. Also: :87 pull --rebase has no --autostash, so recovery from a rejected push fails whenever foreign dirt exists. Fix direction: commit at write time in the writing command (t/cap/triage/writeItemFile) labelled by target project; Stop falls back to one commit per dirty subtree including unbounded/ and overlay/; add --autostash.
- [2026-11-11 06:59] (comment) @claude: Maintainer 2026-11-11: 'That should all be living in claude-kit-data and it should NOT be falling behind on commits/push (full comment #2 in ## Notes)
### comment #2 [2026-11-11 06:59] @claude
Maintainer 2026-11-11: 'That should all be living in claude-kit-data and it should NOT be falling behind on commits/pushes.' Data repo now at 240 uncommitted files across 15 subtrees (inv4d3rs 73, fountain-previz 46, marblequest 27, showtimewarp 26, autoaudit 15, marblerace2 13, rapid-game 11). Agent dispatched this turn.
