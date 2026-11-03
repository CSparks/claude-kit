---
id: KIT-T846
title: process failure: questionnaire briefs are too thin (dirt-empire 2026-11-03). Chris: 'A QUESTIONNAIRE IS FUCKING PREFACED WITH A BRIEF BECAUS
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T01:55:19Z
updated: 2026-11-03T02:09:17Z
---

## Description
process failure: questionnaire briefs are too thin (dirt-empire 2026-11-03). Chris: 'A QUESTIONNAIRE IS FUCKING PREFACED WITH A BRIEF BECAUSE ALL THE RELEVANT FUCKING INFO CAN'T FUCKING FIT THERE.' KIT-D129 requires a brief but nothing checks that it carries the info the options cannot: what is being decided and why now, the evidence found (files, numbers), what each option does and costs, why the recommended one, what stays open. Root cause: the gate tests for the presence of prose before AskUserQuestion, not its sufficiency, and the orchestrator wrote two bullets. Wanted: a content standard for the brief (decision, evidence with sources, per-option consequences, recommendation reason, what is not being asked) checked by the gate before the tool call, plus a readiness check that the topic was discussed to a conclusion, not fired mid-argument.

kit-bug-shape: cap:bug:process-failure-questionnaire-briefs-are-too-thi
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A questionnaire whose preceding prose lacks the decision and why now, 2 sources, per-option consequences, the recommendation reason or what is not asked is blocked (question-brief-gate.test)
- [x] A questionnaire fired at a floated question, or restating the maintainer's own words, is blocked as not ready (question-brief-gate.test)

## Plan
1.

## Notes
8325569 published (plugin 0.1.31). New hooks/question-brief-gate.mjs wired on AskUserQuestion|request_user_input: reads the transcript, blocks a thin brief (check id question-brief) or an unready topic (check id question-ready). Finding: KIT-D129 had no gate behind it (no hook read the brief before this); the ticket's premise that one checked presence was wrong. Not done: hooks/request-gate.mjs and hooks/land-alert.mjs each carry their own transcript parser beside the new hooks/lib/turn-text.mjs (follow-up to unify). Heuristics are keyword and overlap checks, a floor not a judge of quality. question-brief-gate 21 passed.

## History
- [2026-11-03 01:55] (created) bug — process failure: questionnaire briefs are too thin (dirt-empire 2026-11-03). Chris: 'A QUESTIONNAIRE IS FUCKING PREFACED WITH A BRIEF BECAUS
- [2026-11-03 02:05] (landed) 8325569 question-brief-gate: an AskUserQuestion is blocked unless the prose before it holds the decision and why now, sources, e
- [2026-11-03 02:08] (comment) criterion added: A questionnaire whose preceding prose lacks the decision and why now, 2 sources, per-option consequences, the recommendation reason or what is not asked is blocked (question-brief-gate.test)
- [2026-11-03 02:08] (comment) criterion added: A questionnaire fired at a floated question, or restating the maintainer's own words, is blocked as not ready (question-brief-gate.test)
- [2026-11-03 02:08] (status) todo → doing
- [2026-11-03 02:09] (comment) ticked: A questionnaire whose preceding prose lacks the decision and why now, 2 sources, per-option consequences, the recommendation reason or what is not asked is blocked (question-brief-gate.test)
- [2026-11-03 02:09] (comment) ticked: A questionnaire fired at a floated question, or restating the maintainer's own words, is blocked as not ready (question-brief-gate.test)
- [2026-11-03 02:09] (status) doing → review
