---
id: KIT-T308
title: broker wait.mjs returns a job's stale result file (from an earlier attempt, e.g. 'dirty at apply') while the same job id is inflight again a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T16:42:45Z
updated: 2026-10-03T16:54:08Z
---

## Description
broker wait.mjs returns a job's stale result file (from an earlier attempt, e.g. 'dirty at apply') while the same job id is inflight again after a resume, so the waiter reports a finished-looking failure for a job that is still running. Seen: j-muslvph4-tj1o8c inflight since 16:39:19Z, and wait prin

kit-bug-shape: cap:bug:broker-wait-mjs-returns-a-job-s-stale-result-fil
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] wait.mjs treats a result as final only when it is not older than the same job's current inflight start

## Plan
1.

## History
- [2026-10-03 16:42] (created) bug — broker wait.mjs returns a job's stale result file (from an earlier attempt, e.g. 'dirty at apply') while the same job id is inflight again a
- [2026-10-03 16:54] (comment) criterion added: wait.mjs treats a result as final only when it is not older than the same job's current inflight start
- [2026-10-03 16:54] (comment) ticked: wait.mjs treats a result as final only when it is not older than the same job's current inflight start
- [2026-10-03 16:54] (comment) @sonnet55: scripts/broker/current.mjs isCurrentResult; wait.mjs uses it. Tests: scripts/broker/wait.test.mjs (3: stale result with  (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:54] @sonnet55
scripts/broker/current.mjs isCurrentResult; wait.mjs uses it. Tests: scripts/broker/wait.test.mjs (3: stale result with same id inflight keeps waiting, negative controls no-inflight/other-job-inflight, current result final); mutation (always current) fails the stale case. Broker suite 79 passed.
- [2026-10-03 16:54] (status) todo → review
