---
id: KIT-T1312
title: process failure (road-generator main thread 2026-11-16): the overnight rollup ended with a prose 'Waiting on you:' bullet list of four ready
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T15:11:09Z
updated: 2026-11-16T15:18:51Z
---

## Description
process failure (road-generator main thread 2026-11-16): the overnight rollup ended with a prose 'Waiting on you:' bullet list of four ready decisions (push, whole suites, near hamlet vs City, pockets) with no AskUserQuestion; the maintainer had to point it out. Root cause: a rollup reply is not a closing 'work waits on him' sentence, so the prose-ask Stop gate did not fire on a heading plus bullets; and the rollup template put open decisions in a status list. Prevention wanted: prose-ask must also catch a 'Waiting on you' / 'Needs your decision' / 'Open for you' heading followed by bullet items, in a status rollup, and name the AskUserQuestion form; the rollup skill/standup template must route ready decisions to a questionnaire.

kit-bug-shape: cap:bug:process-failure-road-generator-main-thread-2026-:c632c5db
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Finding: the three real replies of the road-generator session (transcript rows 213, 341, 2813) all match prose-ask's existing 'Waiting on you' hard phrase when run through proseAskMatches, so the matcher was not the miss for those. The live gate did not block; cause not provable from the transcript: the gate exempts every reply of a turn in which any non-denied AskUserQuestion ran, and rows 213 and 341 followed turns with questionnaires (row 213's own text mentions them); row 2813 unverified. Fixed what was missing: (1) a rollup heading ('Waiting on you:', '**Needs your decision:**', 'Open for you:', 'Decisions for you:', 'Questions for you:', 'Your call:' ...) with a list item under it is a hard ask (lib/prose-ask.mjs headingAsks), so headings the sentence phrases did not cover ('Decisions for you:') block too; (2) the block names the heading, its first item and the form: one AskUserQuestion, one question per decision, summary first, recommended first; q gates question lists the rule; (3) commands/prime.md and commands/standup.md told the model to present a 'Waiting on you' section verbatim: they now say Pending items as status lines, ready decisions as one AskUserQuestion. t receipt and its skeleton carry no such heading (UAT fill line only). Open design question for the maintainer: the same-turn questionnaire exemption lets a rollup list unrelated waits after any questionnaire; I kept it per the brief. Tests: hooks/prose-ask-gate.test.mjs 166 passed (about 30 new, KIT-T1312); gate-protocol 54, contract-rules 48, question-brief-gate 27, survey 22.

## History
- [2026-11-16 15:11] (created) bug — process failure (road-generator main thread 2026-11-16): the overnight rollup ended with a prose 'Waiting on you:' bullet list of four ready
- [2026-11-16 15:18] (status) todo → review
