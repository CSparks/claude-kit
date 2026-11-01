---
id: KIT-T708
title: broker: an auto-pin job whose pin a linked landing already recorded ends as failed with 'nothing added to commit' (dirt-empire j-mvtutclx-ls
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T18:38:31Z
updated: 2026-11-01T23:12:52Z
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

## History
- [2026-10-29 18:38] (created) bug — broker: an auto-pin job whose pin a linked landing already recorded ends as failed with 'nothing added to commit' (dirt-empire j-mvtutclx-ls
- [2026-11-01 23:12] (status) todo → doing
