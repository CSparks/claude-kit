---
id: KIT-T310
title: broker idle re-check of deferred foreign failures (scripts/broker/deferred.mjs recheckDeferred) blocks newly queued jobs while its cargo run
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T17:10:10Z
updated: 2026-10-03T17:19:55Z
---

## Description
broker idle re-check of deferred foreign failures (scripts/broker/deferred.mjs recheckDeferred) blocks newly queued jobs while its cargo runs (13+ min seen 2026-10-03). A re-check must never delay real work: skip it while any job is queued, check the queue between re-checks, and cancel or abandon a running re-check (killing its cargo process tree, restoring locks via guardLocks) the moment a job arrives.

kit-bug-shape: cap:bug:broker-idle-re-check-of-deferred-foreign-failure
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] no idle re-check starts while a job is queued; a running re-check is killed (process tree) and its locks restored when a job arrives

## Plan
1.

## History
- [2026-10-03 17:10] (created) bug — broker idle re-check of deferred foreign failures (scripts/broker/deferred.mjs recheckDeferred) blocks newly queued jobs while its cargo run
- [2026-10-03 17:19] (comment) criterion added: no idle re-check starts while a job is queued; a running re-check is killed (process tree) and its locks restored when a job arrives
- [2026-10-03 17:19] (comment) ticked: no idle re-check starts while a job is queued; a running re-check is killed (process tree) and its locks restored when a job arrives
- [2026-10-03 17:19] (comment) @sonnet55: run-cancellable.mjs + run-child.mjs run the re-check in a killable child tree (taskkill /T /F on Windows, group SIGKILL  (full comment #1 in ## Notes)
### comment #1 [2026-10-03 17:19] @sonnet55
run-cancellable.mjs + run-child.mjs run the re-check in a killable child tree (taskkill /T /F on Windows, group SIGKILL elsewhere), polling the queue; deferred.mjs returns early on a queued job and abandons a running re-check inside guardLocks; queue.mjs then drains the arrived job. Tests: scripts/broker/recheck-yield.test.mjs (3: queued job no start, empty queue runs to completion, mid-run arrival kills process + restores Cargo.lock + job passes). Mutation (shouldCancel always false) fails the mid-run test. Broker suite 82 passed.
- [2026-10-03 17:19] (status) todo → review
