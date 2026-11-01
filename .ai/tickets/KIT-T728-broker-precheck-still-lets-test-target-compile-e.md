---
id: KIT-T728
title: broker precheck still lets test-target compile errors through on non-measure jobs (after KIT-T726 / runtime 8995b3a). dirt-empire j-mvv60l8r
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T16:13:26Z
updated: 2026-10-30T16:27:43Z
---

## Description
broker precheck still lets test-target compile errors through on non-measure jobs (after KIT-T726 / runtime 8995b3a). dirt-empire j-mvv60l8r-5iefqs (DE-T254) failed at run with E0433/E0277 in src (RideWarm derive(Resource)), and j-mvv65j9d-b9ym67 failed at run with E0599 'no method named free_ride_start' in tests/free_ride; both named --test free_ride targets. Expected: submit precheck cargo-checks every named test target (--test free_ride etc.) and the lib, and refuses on rustc errors before queueing. Each miss costs a 5-10 min queued run.

kit-bug-shape: cap:bug:broker-precheck-still-lets-test-target-compile-e
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: not narrowCheck (it yields '--lib --test track --test free_ride' for both jobs; test added in precheck-scope.test.mjs). j-mvv60l8r (submitted 16:06:59Z) and j-mvv65j9d (16:10:49Z) each arrived while another job's precheck held the per-repo lock (j-mvv60cfq 16:06:47-16:08:19Z; j-mvv63xy7 16:09:35-16:11:24Z) and the old takeLock returned null, so they queued unchecked; neither has a precheck-*.log. The daemon-start theory does not hold: precheck runs before ensureQueuedLanes in submit.mjs. Fix: precheck.mjs takeLock waits up to precheckTimeoutMs for the holder. Tests: precheck.test.mjs (waits for holder then rejects), precheck-scope.test.mjs; publish:runtime green, runtime 741409c.

## History
- [2026-10-30 16:13] (created) bug — broker precheck still lets test-target compile errors through on non-measure jobs (after KIT-T726 / runtime 8995b3a). dirt-empire j-mvv60l8r
- [2026-10-30 16:22] (landed) 741409c broker: a --measure job whose command does not compile ends compile-error and is prechecked at submit; a submit waits fo
- [2026-10-30 16:27] (status) todo → review
