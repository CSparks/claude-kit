---
id: KIT-T1448
title: Process failure: the coordinator sent an AskUserQuestion with no plain summary in the message directly above it (the summary had been writte
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-20T20:59:29Z
updated: 2026-11-21T14:55:54Z
---

## Description
Process failure: the coordinator sent an AskUserQuestion with no plain summary in the message directly above it (the summary had been written earlier in the turn, before other tool calls), and the question gate passed it. Prevention: the question gate must require the summary text in the same assistant message immediately before the AskUserQuestion call, and a re-ask after a clarification gets its own fresh summary (KIT-D153 protocol).

kit-bug-shape: cap:bug:process-failure-the-coordinator-sent-an-askuserq:584ecd7a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: (1) check-id question-self-contained, PreToolUse hook hooks/question-self-contained-gate.mjs: each question text needs 400+ chars after [..] tags are cut, block prints the form; hooks/question-self-contained-gate.test.mjs 17 passed. (2) question-brief audit counts only prose directly above the call (turnText adjacent): a tool call or answer between cuts it, a hook-denied call does not, a re-ask needs its own summary, question text no longer substitutes; question-brief-turn 22, -blocked 10, -narration 9, -audit 22, -gate 27 passed; gate-protocol 57, prose-ask 179. Landed a5a9358f, runtime 1a2bd36c.
Completed by KIT-T1465: the one leniency left (a hook-refused call did not separate the summary from its resend) is removed in hooks/lib/turn-text.mjs; hooks/question-brief-blocked.test.mjs now asserts the resend needs its own summary.

## History
- [2026-11-20 20:59] (created) bug — Process failure: the coordinator sent an AskUserQuestion with no plain summary in the message directly above it (the summary had been writte
- [2026-11-20 21:12] (landed) a5a9358f push-drift gate and self-contained questionnaires: a push is refused while a checked-out submodule differs from the poin
- [2026-11-20 21:13] (landed) 1a2bd36c plugin 0.1.63: the hooks.json wiring of question-self-contained-gate reaches sessions (implements KIT-T1448, KIT-T1447)
- [2026-11-21 14:55] (status) todo → review
