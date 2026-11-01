---
id: KIT-T798
title: regression of KIT-T734 (abbbc1a): broker-wait-gate still treats a one-shot shell for loop that reads finished target/broker/logs/*.log files
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:34:40Z
updated: 2026-11-01T19:51:09Z
regressed_from: KIT-T734
parent: KIT-T785
---

## Description
regression of KIT-T734 (abbbc1a): broker-wait-gate still treats a one-shot shell for loop that reads finished target/broker/logs/*.log files (two log greps, no sleep, no broker client call) as a broker poll and blocks it; dirt-empire-83 patch worker, 2026-11-01. A loop with no sleep, no wait or watch, and no repeated re-read of the same file is not a poll

kit-bug-shape: cap:bug:regression-of-kit-t734-abbbc1a-broker-wait-gate-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not edited by this agent: the working tree already carries another writer's uncommitted fix (KIT-T785, T784, T711 in the broker-wait gate, broker-calls and its test): a counted loop is a poll only around a broker client call, while a pause, an until or while loop, or a follow-tail around the broker state dir still blocks. Probed that working-tree gate with the exact case (a counted loop over the finished log files running two greps): exit 0; a polling loop with a pause: exit 2. The sealed runtime at 99d4cc5 still has the old regex. This ticket closes when that writer's change lands and publishes; add the two-grep read as a test case there. [no-test: covered by the KIT-T785 work in progress, not mine to commit]
Landed by d85eb23 (KIT-T785). Test added: hooks/broker-wait-gate.test.mjs KIT-T798 cases, a for loop of two greps over finished target/broker/logs job logs passes; a while+sleep loop over the same logs still blocks. broker-wait-gate 70 passed.

## History
- [2026-11-01 19:34] (created) bug — regression of KIT-T734 (abbbc1a): broker-wait-gate still treats a one-shot shell for loop that reads finished target/broker/logs/*.log files
- [2026-11-01 19:35] (status) todo → doing
- [2026-11-01 19:51] (status) doing → review
- [2026-11-01 19:51] (landed) 4e4b517 broker-wait-gate: a for loop of two greps over finished broker job logs passes, a while+sleep loop over them still block
