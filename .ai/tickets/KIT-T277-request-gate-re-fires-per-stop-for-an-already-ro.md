---
id: KIT-T277
title: request-gate re-fires per Stop for an already routed prompt
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:04:08Z
updated: 2026-10-02T15:07:25Z
---

## Description
request-gate checked the receipt token only in the final reply and kept no memory of a handled prompt. Now scans every assistant reply since the prompt and records a fired-key per prompt (turn-state slot request-gate-fired). A ticket write was not added as a valve: tickets are edited every turn (test 11 pins that). Tests: hooks/request-gate.test.mjs cases 21-22 (fail before, pass after).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a token or routing in any reply since the prompt clears the gate; the gate fires at most once per prompt

## Plan
1.

## History
- [2026-10-02 15:04] (created) bug — request-gate re-fires per Stop for an already routed prompt
- [2026-10-02 15:05] (comment) criterion added: a token or routing in any reply since the prompt clears the gate; the gate fires at most once per prompt
- [2026-10-02 15:05] (comment) ticked: a token or routing in any reply since the prompt clears the gate; the gate fires at most once per prompt
- [2026-10-02 15:07] (status) todo → review
