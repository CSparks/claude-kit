---
id: KIT-T929
title: question-brief-gate 'exploring' check blocks a ready questionnaire because the maintainer's newest message contains a question that was alre
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T00:16:53Z
updated: 2026-11-10T00:20:05Z
---

## Description
question-brief-gate 'exploring' check blocks a ready questionnaire because the maintainer's newest message contains a question that was already answered in an earlier reply, and also fires on rhetorical anger ('TWO FUCKING LEADS. EVER HEAR TWO FUCKING LEAD GUITARS ...?'). groovegrid 2026-11-10: Chris wrote 'Let's do it. What's the analyst doing right now?'; the orchestrator answered it in prose; the planner then finished and a 4-question questionnaire carrying the build sign-off was blocked with 'his newest message is a question'. Fix: treat the newest user message as answered once an assistant reply after it contained prose and no AskUserQuestion was pending; do not count rhetorical questions in messages with profanity and no question word; show the exact message that tripped the check. Today the only escape is the maintainer sending a non-question message, which the maintainer has said he should never have to do ('NOTHING IS FUCKING WAITING ON ME IF I DON'T GET A FUCKING QUESTIONNIRE').

kit-bug-shape: cap:bug:question-brief-gate-exploring-check-blocks-a-rea
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 00:16] (created) bug — question-brief-gate 'exploring' check blocks a ready questionnaire because the maintainer's newest message contains a question that was alre
- [2026-11-10 00:20] (status) todo → review
- [2026-11-10 00:20] (comment) @kit-agent: Fixed: the exploring check is skipped once at least 20 words of assistant prose followed the message; a question mark in (full comment #1 in ## Notes)
### comment #1 [2026-11-10 00:20] @kit-agent
Fixed: the exploring check is skipped once at least 20 words of assistant prose followed the message; a question mark in a yelled or profane message with no question word is not a question; the block prints the last 240 characters of the message that tripped it. Real question words and explicit floated ideas still block.
- [2026-11-10 00:20] (landed) 5bdcdd5 question-brief-gate: the exploring check no longer blocks a message a prose reply already answered (20 words of assistan
