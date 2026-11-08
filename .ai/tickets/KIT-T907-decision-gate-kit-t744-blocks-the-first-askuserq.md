---
id: KIT-T907
title: decision-gate (KIT-T744) blocks the first AskUserQuestion of every questionnaire with a large error and passes the identical resend: a block
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T21:55:46Z
updated: 2026-11-08T22:06:01Z
---

## Description
decision-gate (KIT-T744) blocks the first AskUserQuestion of every questionnaire with a large error and passes the identical resend: a block-once ritual, not a check. Fired on both questionnaires in groovegrid session da28715f on 2026-11-08 (Shift-click/audit/slice B; gate fix). It listed GG-D051, GG-D048, GG-D047, none of which decided the question. Chris 2026-11-08: "I do not want to be seeing that big fucking error all the fucking time. If you have to hit that first, then there is a bug in the process." Wanted: no blocking error when the questionnaire is a genuine open question; surface candidate decisions without a block (or block only on a strong match, e.g. the question restates a decision), and never require an unchanged resend to pass.

kit-bug-shape: cap:bug:decision-gate-kit-t744-blocks-the-first-askuserq
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A questionnaire that only shares words with decisions passes with them listed as advisory context; one repeating a whole decision title is blocked every time, with no resend (hooks/decision-gate.test.mjs, real groovegrid replays, threshold mutation)

## Plan
1.

## Notes
Root cause: governingDecisions matched on word overlap (two shared title words, or four with the summary and Decision text, options included) and the gate then blocked once per questionnaire hash and passed the identical resend: a ritual, not a check, firing on any questionnaire near a decision's topic. Replayed against the real groovegrid decisions and questionnaires (da28715f entries 482 and 1816): GG-D047/GG-D025 and GG-D051/GG-D048/GG-D047 were listed though none decided the question; the closest title coverage in the question and header text was GG-D051 at 3 of 5 words.
Fix 7da7b29: scripts/decision-governs.mjs restatedDecisions blocks only when the question and header text repeat every distinctive word of a decision's title (3 or more words); the block repeats until the question is rewritten or the decision excluded, and its text no longer offers a resend. Everything that merely shares words is printed as hookSpecificOutput.additionalContext on stdout with exit 0: advisory, no error. The turn-state resend slot is gone from the gate.
Tests: hooks/decision-gate.test.mjs 15 passed (both real questionnaires replayed with their decision titles, a restating question and header still blocked and blocked again on repeat, unrelated, superseded and excluded negatives). Mutation: loosening the restated threshold to two shared words fails 5 tests.
Not verified live: that Claude Code shows PreToolUse additionalContext to the model for AskUserQuestion; the exit-0 path itself emits no error either way.

## History
- [2026-11-08 21:55] (created) bug — decision-gate (KIT-T744) blocks the first AskUserQuestion of every questionnaire with a large error and passes the identical resend: a block
- [2026-11-08 21:56] (comment) @claude: Chris 2026-11-08: "Because I do not wnat to be seeing tha tbig fuckign error all the fucking time. If you have to hit th (full comment #1 in ## Notes)
### comment #1 [2026-11-08 21:56] @claude
Chris 2026-11-08: "Because I do not wnat to be seeing tha tbig fuckign error all the fucking time. If you have to hit that first, then there's a bug in the process." and "The process should be Summary to inform the questionnaire, then the questionnaire." Governing: the new decision amending KIT-D142.
- [2026-11-08 22:02] (landed) 7da7b29 decision-gate: block only a questionnaire that repeats a whole decision title (every time, no resend passes); decisions
- [2026-11-08 22:05] (comment) criterion added: A questionnaire that only shares words with decisions passes with them listed as advisory context; one repeating a whole decision title is blocked every time, with no resend (hooks/decision-gate.test.mjs, real groovegrid replays, threshold mutation)
- [2026-11-08 22:05] (comment) ticked: A questionnaire that only shares words with decisions passes with them listed as advisory context; one repeating a whole decision title is blocked every time, with no resend (hooks/decision-gate.test.mjs, real groovegrid replays, threshold mutation)
- [2026-11-08 22:06] (status) todo → review
