---
id: KIT-T429
title: Process failure (dirt-empire 2026-10-12): a control model Chris ruled in conversation and the assistant restated back ('reverse while going
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T20:10:27Z
updated: 2026-10-12T20:10:27Z
---

## Description
Process failure (dirt-empire 2026-10-12): a control model Chris ruled in conversation and the assistant restated back ('reverse while going forward is effectively a brake; separate forces for slowing down') was never written to the decision record. DE-D011 captured only the narrow standstill sub-rule, so a later session re-derived the pedal model and put a deadzone question to Chris that contradicted his ruling. Root cause: decision capture records the fix being landed, not the model the maintainer and assistant agreed on. Proposal: when the assistant restates a maintainer's model back ('so X is Y'), the request/decision gate requires that restatement to land in DECISIONS the same turn.

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-12-a-control
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 20:10] (created) bug — Process failure (dirt-empire 2026-10-12): a control model Chris ruled in conversation and the assistant restated back ('reverse while going
