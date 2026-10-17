---
id: KIT-T557
title: broker: one pre-push gate per push: a train's landing members share a single gate on the tip commit (train-one-gate.test.mjs asserts a 3-member train runs it once)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T20:39:20Z
updated: 2026-10-17T21:01:16Z
---

## Description
Chris 2026-10-17 questionnaire. landCommits already pushes a train once and gates once on the tip; the ST-T904 round 7 report of every member paying its own gate matches single landings, not a train. Test added, no code change.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T535, KIT-T482, KIT-T545, KIT-T553
landCommits/pushLanding already runs one gate per push. scripts/broker/train-one-gate.test.mjs: a 3-member train runs the full gate once on the tip (then the real push takes the stamp, 'gate <tip>','fast'); control: three single landings run it three times. 2 passed. No code change.

## History
- [2026-10-17 20:39] (created) feature — broker: one pre-push gate per push: a train's landing members share a single gate on the tip commit (train-one-gate.test.mjs asserts a 3-member train runs it once)
- [2026-10-17 21:01] (status) todo → review
