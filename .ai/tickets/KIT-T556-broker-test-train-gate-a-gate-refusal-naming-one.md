---
id: KIT-T556
title: broker test train-gate 'a gate refusal naming one member drops it and lands the other two' times out under machine load (1 of 362 in the ful
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T18:59:30Z
updated: 2026-10-18T01:35:44Z
---

## Description
broker test train-gate 'a gate refusal naming one member drops it and lands the other two' times out under machine load (1 of 362 in the full broker glob at 0dbc1ea; 3/3 alone). A timing-dependent test in the publish gate will block publishes at random.

kit-bug-shape: cap:bug:broker-test-train-gate-a-gate-refusal-naming-one
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause was not a timeout: the failing run died in fixture setup, 'git push -u origin main failed, status 1' with empty stderr and stdout, a git spawn failing under machine load. testkit g() now retries a failure with no output at all (a git refusal always says why). train-gate 3 passed.

## History
- [2026-10-17 18:59] (created) bug — broker test train-gate 'a gate refusal naming one member drops it and lands the other two' times out under machine load (1 of 362 in the ful
- [2026-10-18 01:35] (status) todo → review
