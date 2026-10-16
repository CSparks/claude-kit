---
id: KIT-T535
title: broker: one patch's pre-push gate failure (check:scripts red on dent_readback.rs missing from the nextest gpu group) refused ALL three landi
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T23:39:47Z
updated: 2026-10-16T14:58:54Z
---

## Description
broker: one patch's pre-push gate failure (check:scripts red on dent_readback.rs missing from the nextest gpu group) refused ALL three landings in train j-mva1p0x6/j-mva1p0z3/j-mva1p0ye and the broker undid every commit; two unrelated jobs resubmitted and paid a second full train (1 h 5 min). A per-patch gate failure should drop that patch from the train and land the rest, not undo the train. Also: pre-push gate time grew from 12-18 min to 43 min with a 3-patch train. ST-T904#18 FAULT 7. --priority high

kit-bug-shape: cap:bug:broker-one-patch-s-pre-push-gate-failure-check-s
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 23:39] (created) bug — broker: one patch's pre-push gate failure (check:scripts red on dent_readback.rs missing from the nextest gpu group) refused ALL three landi
- [2026-10-15 23:40] (comment) seen again in stiletto-2349: broker: one patch's pre-push gate failure (check:scripts red on dent_readback.rs missing from the nextest gpu group) refused ALL three landings in train j-mva1p0x6/j-mva1p0z3 and the broker undid every commit; two unrelated jobs resubmitted and paid a second full train (1 h 5 min). A per-patch gate
- [2026-10-15 23:40] (asked again) 2026-10-15 — cap:bug:broker-one-patch-s-pre-push-gate-failure-check-s
- [2026-10-16 14:58] (comment) @claude: Implementing commit 3311864 (a pre-push gate refusal in a train fails the member its log names, else bisects, and lands  (full comment #1 in ## Notes)
### comment #1 [2026-10-16 14:58] @claude
Implementing commit 3311864 (a pre-push gate refusal in a train fails the member its log names, else bisects, and lands the rest; train-gate 3 passed, batch/land-gate/linked/phase 27 passed). Status drift fixed: todo -> review.
- [2026-10-16 14:58] (status) todo → review
