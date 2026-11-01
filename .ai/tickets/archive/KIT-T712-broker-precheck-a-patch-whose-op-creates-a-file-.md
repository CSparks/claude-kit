---
id: KIT-T712
title: broker precheck: a patch whose op creates a file that already exists (create-exists) still takes a queue slot and comes back stale later (di
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:44:31Z
updated: 2026-10-31T01:18:24Z
fixed_commit: 39f8389
---

## Description
broker precheck: a patch whose op creates a file that already exists (create-exists) still takes a queue slot and comes back stale later (dirt-empire j-mvty89pb-jfqxep, j-mvtvw5yn-cff9ub). The submit-time precheck should apply the ops to its tree and reject create-exists before queueing, the same as compile and gate errors.

kit-bug-shape: cap:bug:broker-precheck-a-patch-whose-op-creates-a-file-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Already satisfied: the cited jobs j-mvty89pb-jfqxep and j-mvtvw5yn-cff9ub in dirt-empire target/broker/results carry phase submit-dryrun, commands [], status stale with reason create-exists: the submit-time dry-run rejected them before queueing, so neither took a queue slot (dry-run since KIT-T276; hints and the identical-resubmit refusal in 39f8389, KIT-T503). Evidence: scripts/broker/submit-refusal.test.mjs 5 passed, submit-inflight.test.mjs 1 passed.

## History
- [2026-10-29 19:44] (created) bug — broker precheck: a patch whose op creates a file that already exists (create-exists) still takes a queue slot and comes back stale later (di
- [2026-10-31 01:18] (status) todo → done
