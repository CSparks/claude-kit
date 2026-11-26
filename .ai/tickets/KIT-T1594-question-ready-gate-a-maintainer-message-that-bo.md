---
id: KIT-T1594
title: question-ready gate: a maintainer message that both asks a question and signs off work ('Can this live view integrate into Herder? Yeah, let
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:08:18Z
updated: 2026-11-26T01:14:00Z
---

## Description
question-ready gate: a maintainer message that both asks a question and signs off work ('Can this live view integrate into Herder? Yeah, let's do the whole fleet launch...') is classed as exploring; the prose answer to his question written in the same message directly above AskUserQuestion is not counted as answering it, so the follow-up questionnaire on the signed items is blocked. Root cause: the exploring classifier reads only whether his newest message ends in a question and whether a prior-turn prose reply exists; it ignores sign-off language in the message and the same-message answer text.

kit-bug-shape: cap:bug:question-ready-gate-a-maintainer-message-that-bo:df1918f3
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in hooks/lib/question-ready.mjs: text after the last question mark in the tail that carries sign-off (SIGN_OFF) and no floated-idea word makes the message ready. Same-message answer text cannot be counted: Claude Code writes the call's reply after PreToolUse hooks run (KIT-T881, KIT-D152); the block message now says so. Tests: hooks/question-brief-gate.test.mjs 30 passed 1 failed before the fix (the ticket's message), 31 passed after; controls (question last, hedge after the question, sign-off with a hedge) block. gate-protocol.test.mjs 64/1 both with and without this change (filed KIT-T1595).

## History
- [2026-11-26 01:08] (created) bug — question-ready gate: a maintainer message that both asks a question and signs off work ('Can this live view integrate into Herder? Yeah, let
- [2026-11-26 01:14] (status) todo → review
