---
id: KIT-T1136
title: process failure, recurrence of KIT-T1130 (road-generator main thread, 2026-11-13): a need for the maintainer's approval (the commit-foreign
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T17:11:46Z
updated: 2026-11-13T17:20:30Z
---

## Description
process failure, recurrence of KIT-T1130 (road-generator main thread, 2026-11-13): a need for the maintainer's approval (the commit-foreign override for 10 inherited files) was written as a prose section 'One thing I need from you' at the end of a reply with no questionnaire, hours after the same failure was captured. Root cause: nothing checks a reply for a request to the maintainer outside AskUserQuestion. Prevention wanted: the Stop hook flags reply text that asks the maintainer for approval or an action (needs your say, I need from you, waiting on you, your approval) when no AskUserQuestion was called that turn.

kit-bug-shape: cap:bug:process-failure-recurrence-of-kit-t1130-road-gen
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)

## Plan
1.

## History
- [2026-11-13 17:11] (created) bug — process failure, recurrence of KIT-T1130 (road-generator main thread, 2026-11-13): a need for the maintainer's approval (the commit-foreign
- [2026-11-13 17:20] (landed) 167e49c Two Stop gates: prose-ask blocks a closing reply that asks the maintainer for something in prose with no questionnaire,
- [2026-11-13 17:20] (comment) criterion added: Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)
- [2026-11-13 17:20] (comment) ticked: Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)
- [2026-11-13 17:20] (status) todo → review
- [2026-11-13 17:20] (comment) @kit-agent: Fixed in 167e49c: hooks/prose-ask-gate.mjs plus hooks/process-failure-dispatch.mjs, decision KIT-D168. prose-ask-gate 27 passed, process-failure-dispatch 12, block-triage 13, contract-rules 24.
