---
id: KIT-T708
title: broker: an auto-pin job whose pin a linked landing already recorded ends as failed with 'nothing added to commit' (dirt-empire j-mvtutclx-ls
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T18:38:31Z
updated: 2026-11-01T23:17:07Z
---

## Description
broker: an auto-pin job whose pin a linked landing already recorded ends as failed with 'nothing added to commit' (dirt-empire j-mvtutclx-ls1wta, after linked DE-T219 landing be6c93d had already pinned rapid-game c5eb5ee1). It should end as a no-op success, not a red run. Also: the commit-gate hook fired on a Bash call whose only 'commit' text sat inside a quoted cap message argument (false positive).

kit-bug-shape: cap:bug:broker-an-auto-pin-job-whose-pin-a-linked-landin
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: pin-stale.mjs lets an equal pin through (recorded===sha), so a pin-only auto-pin job whose gitlink a linked landing had already recorded reached 'git commit' with nothing staged: dirt-empire j-mvtutclx-ls1wta failed in phase land with 'nothing added to commit'. Fix: patch.mjs ends such a job passed in phase pin with 'already recorded' (recordedPins in pin-stale.mjs); wait exits 0 for passed and reportRedPin ignores it. Test scripts/broker/pin-stale.test.mjs 5 passed, mutation-checked (disabling the fix fails the new test). Second part (commit-gate firing on 'commit' inside a quoted cap argument): already fixed by d85eb23; verified a quoted cap bug text containing 'git commit' passes commit-gate.

## History
- [2026-10-29 18:38] (created) bug — broker: an auto-pin job whose pin a linked landing already recorded ends as failed with 'nothing added to commit' (dirt-empire j-mvtutclx-ls
- [2026-11-01 23:12] (status) todo → doing
- [2026-11-01 23:17] (status) doing → review
- [2026-11-01 23:17] (landed) 7b7701d broker: a pin-only landing whose pins HEAD already records ends passed ('already recorded') instead of failing on nothin
