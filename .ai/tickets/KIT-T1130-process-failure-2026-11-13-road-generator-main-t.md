---
id: KIT-T1130
title: process failure 2026-11-13 (road-generator main thread): a ready decision (the go-ahead for the volume terrain mesher's next steps after its
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T14:56:20Z
updated: 2026-11-13T17:20:36Z
---

## Description
process failure 2026-11-13 (road-generator main thread): a ready decision (the go-ahead for the volume terrain mesher's next steps after its approved checkpoint, RDG-T057) was left in prose as 'still waiting on you' across about ten replies instead of being put in an AskUserQuestion; the work sat idle for hours. Chris: 'You're not waiting for me if I don't come back and see a fucking questionnaire. Process failure.' Root cause: the first questionnaire attempt this session was blocked for firing during an open discussion, and the orchestrator then avoided questionnaires and parked the decision in a trailing prose line, which the anti-prose-decision rule forbids. Prevention: a decision that blocks work is either made by the orchestrator (reversible) or put in a questionnaire the same turn it becomes ready; a reply may not end with 'waiting on you' for anything but an action only he can perform, stated as an action. Asked of the kit: the Stop hook flags the phrases 'waiting on you' / 'need your go' / 'your go-ahead' in a reply that carries no AskUserQuestion.

kit-bug-shape: cap:bug:process-failure-2026-11-13-road-generator-main-t
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)

## Plan
1.

## History
- [2026-11-13 14:56] (created) bug — process failure 2026-11-13 (road-generator main thread): a ready decision (the go-ahead for the volume terrain mesher's next steps after its
- [2026-11-13 17:20] (landed) 167e49c Two Stop gates: prose-ask blocks a closing reply that asks the maintainer for something in prose with no questionnaire,
- [2026-11-13 17:20] (comment) criterion added: Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)
- [2026-11-13 17:20] (comment) ticked: Stop gate prose-ask blocks a closing reply asking the maintainer for something in prose with no questionnaire (tests: node hooks/prose-ask-gate.test.mjs, 27 passed; commit 167e49c)
- [2026-11-13 17:20] (status) todo → review
- [2026-11-13 17:20] (comment) @kit-agent: Fixed in 167e49c: prose-ask gate (KIT-T1136 covers the same fix), decision KIT-D168, contract lines. prose-ask-gate 27 passed, process-failure-dispatch 12, block-triage 13, contract-rules 24.
