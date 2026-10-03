---
id: KIT-T317
title: broker submit.mjs --no-patch: a test-only job that runs the --test commands on HEAD with no operations (check-only; --land with no operation
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T22:25:06Z
updated: 2026-10-03T22:29:18Z
---

## Description
broker submit.mjs --no-patch: a test-only job that runs the --test commands on HEAD with no operations (check-only; --land with no operations is refused), so a worker can check whether a failure is already on main

kit-bug-shape: cap:feature:broker-submit-mjs-no-patch-a-test-only-job-that-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] submit --no-patch queues a test-only job that runs the --test commands on HEAD, check-only; --land with it is refused

## Plan
1.

## History
- [2026-10-03 22:25] (created) feature — broker submit.mjs --no-patch: a test-only job that runs the --test commands on HEAD with no operations (check-only; --land with no operation
- [2026-10-03 22:29] (comment) criterion added: submit --no-patch queues a test-only job that runs the --test commands on HEAD, check-only; --land with it is refused
- [2026-10-03 22:29] (comment) ticked: submit --no-patch queues a test-only job that runs the --test commands on HEAD, check-only; --land with it is refused
- [2026-10-03 22:29] (comment) @sonnet55: submit.mjs --no-patch (no stdin envelope), submit-lib builds ops [] and refuses --land, patch.mjs refuses a landing with (full comment #1 in ## Notes)
### comment #1 [2026-10-03 22:29] @sonnet55
submit.mjs --no-patch (no stdin envelope), submit-lib builds ops [] and refuses --land, patch.mjs refuses a landing with no ops and skips attribution for a test-only job (its failures are the baseline's, so the job fails and names them). Tests: scripts/broker/testonly.test.mjs (4 incl. negatives: empty envelope without the flag still refused). Mutation (attribution not skipped) fails the failing-test case. Broker suite 92 passed.
- [2026-10-03 22:29] (status) todo → review
