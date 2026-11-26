---
id: KIT-T1598
title: question-ready 'stated' rule false positive: a question asking the SCOPE of an approved item ('What should whole-fleet launch do on the comm
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:18:24Z
updated: 2026-11-26T01:31:20Z
---

## Description
question-ready 'stated' rule false positive: a question asking the SCOPE of an approved item ('What should whole-fleet launch do on the commodore?') was blocked as restating his words ('let's do the whole fleet launch'). Root cause: the restatement check matches on shared words with his message and does not tell a question about an unstated detail of an approved item apart from asking back the approval itself.

kit-bug-shape: cap:bug:question-ready-stated-rule-false-positive-a-ques:aa2cb109
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in hooks/lib/question-ready.mjs: stated now needs every distinctive stem of the question sentence (at least 4, header excluded, asking words confirm/proceed/approve/agree/correct/right/please ignored) to be in his message; the 75% share is gone. KIT-T846 records no case of an unstated word that had to block. Tests: question-brief-gate 34/1 before (the commodore case), 35/0 after; controls: a 'Confirm:' ask-back and a verbatim ask-back under an unrelated header block. gate-protocol 65/0, question-gates-first-try 41/0, block-triage 13/0. Loosened edge: an ask-back reworded with one word he did not say now passes. Gap not changed: a short ask-back with under 4 distinctive words ('Should we do the whole fleet launch now?', 3 stems) passed before and still passes.

## History
- [2026-11-26 01:18] (created) bug — question-ready 'stated' rule false positive: a question asking the SCOPE of an approved item ('What should whole-fleet launch do on the comm
- [2026-11-26 01:31] (status) todo → review
