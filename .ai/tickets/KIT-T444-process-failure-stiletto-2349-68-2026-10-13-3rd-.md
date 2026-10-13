---
id: KIT-T444
title: Process failure (stiletto-2349-68, 2026-10-13, 3rd instance this programme after KIT-T439 sleep/wake and RG-T086 bake parallelism): ST-D228
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T06:55:46Z
updated: 2026-10-13T07:46:35Z
---

## Description
Process failure (stiletto-2349-68, 2026-10-13, 3rd instance this programme after KIT-T439 sleep/wake and RG-T086 bake parallelism): ST-D228 offered 'dynamic degradation setting' as an unbuilt lane and the RG-T188 design brief told the analyst nothing was built, while RG-T188 History #8 records S1+S2 landed (rapid-game 3e5fb1e, stiletto b3e28db7) and S3 (34656b0, 620f1556), and #7 records Chris approving the staged design 2026-10-07 21:53. ROOT CAUSE: grounding read ticket STATUS (todo after the 2026-10-10 park) and criteria (all unticked), not History; and the park comment #9 contradicted History ('no acceptance criterion met yet, design not yet presented') with nothing flagging the contradiction. A ticket whose implementing commits are in git but whose criteria stay unticked reads as unbuilt to every later grounding. FIX: (1) the commit hook, on '(implements <id>)', appends '(landed) <sha> <subject>' to that ticket's History automatically (the writer's comment is optional, the stamp is not); (2) q show / orient print 'LANDED COMMITS: n (last <sha>)' for any todo/doing ticket whose id appears in git log subjects, and a todo ticket with landed commits is flagged 'built but unticked'; (3) a status flip to todo on a ticket with landed commits requires a '--remaining <text>' note. Links KIT-T439, KIT-T437.

kit-bug-shape: cap:bug:process-failure-stiletto-2349-68-2026-10-13-3rd-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A git commit citing (implements <id>) appends one idempotent (landed) <sha> <subject> History line to each cited ticket in any registered store; unknown ids warn (hooks/commit-stamp.test.mjs)
- [x] q show prints LANDED COMMITS: n (last <sha> <date>); orient marks todo/doing tickets with landed commits built-but-unticked (hooks/commit-stamp.test.mjs)
- [x] t status <id> todo on a ticket with landed commits refuses without --remaining and records the text as a comment (hooks/commit-stamp.test.mjs)

## Plan
1.

## History
- [2026-10-13 06:55] (created) bug — Process failure (stiletto-2349-68, 2026-10-13, 3rd instance this programme after KIT-T439 sleep/wake and RG-T086 bake parallelism): ST-D228
- [2026-10-13 07:46] (comment) criterion added: A git commit citing (implements <id>) appends one idempotent (landed) <sha> <subject> History line to each cited ticket in any registered store; unknown ids warn (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) criterion added: q show prints LANDED COMMITS: n (last <sha> <date>); orient marks todo/doing tickets with landed commits built-but-unticked (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) criterion added: t status <id> todo on a ticket with landed commits refuses without --remaining and records the text as a comment (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) ticked: A git commit citing (implements <id>) appends one idempotent (landed) <sha> <subject> History line to each cited ticket in any registered store; unknown ids warn (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) ticked: q show prints LANDED COMMITS: n (last <sha> <date>); orient marks todo/doing tickets with landed commits built-but-unticked (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) ticked: t status <id> todo on a ticket with landed commits refuses without --remaining and records the text as a comment (hooks/commit-stamp.test.mjs)
- [2026-10-13 07:46] (comment) @claude: Built: hooks/commit-stamp.mjs (PostToolUse after git commit; stamps ids listed after 'implements' only, tickets only, vi (full comment #1 in ## Notes)
### comment #1 [2026-10-13 07:46] @claude
Built: hooks/commit-stamp.mjs (PostToolUse after git commit; stamps ids listed after 'implements' only, tickets only, via scripts/landed.mjs + q-show findItemFile across project, framework and registered stores); q show LANDED COMMITS line; orient built-but-unticked list; t status todo needs --remaining. Tests: hooks/commit-stamp.test.mjs 12 passed (stamp once across two commits, two ids across two stores, unknown id warns and exits 0, non-commit untouched, q show count and no-landed case, orient list, refused and accepted todo flips, other transitions free). Full package.json chain 98 commands: only the 4 failures that also fail at HEAD (db-cache similar-parity, dispatch-broker, activity-tag, server.test). Not done: 'landed' not added to .ai/config.yml history.events (the vocabulary is not validated; edit was blocked by the auto-mode classifier).
- [2026-10-13 07:46] (status) todo → review
- [2026-10-13 07:46] (landed) cb88cb9 Landed commits are stamped on their ticket: commit-stamp hook appends (landed) <sha> <subject>, q show prints LANDED COM
