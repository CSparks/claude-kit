---
id: KIT-T1349
title: query-gate one-file-search blocks 'tail -n 0 -F target/broker/finished.log | grep --line-buffered -E <run ids>' in a Monitor: the documented
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T19:22:14Z
updated: 2026-11-17T19:22:14Z
---

## Description
query-gate one-file-search blocks 'tail -n 0 -F target/broker/finished.log | grep --line-buffered -E <run ids>' in a Monitor: the documented way to resume on a finished run (finished.log, one Monitor); the gate offers only q code (not streaming). Needs an allowed streaming form (e.g. builds --watch <run ids> or an exemption for tail-follow of finished.log)

kit-bug-shape: cap:bug:query-gate-one-file-search-blocks-tail-n-0-f-tar:f332b38a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Exemption: hooks/lib/one-file-search.mjs fedFile ignores a tail follow (-f, -F, --follow) of a file named finished.log, so the Monitor stream 'tail -n 0 -F target/broker/finished.log | grep --line-buffered -E <ids>' passes; any other file, a plain tail or cat of finished.log, and grep of it stay blocked. The one-file-search block text and docs/BROKER.md name the form. Test: hooks/query-gate-finished-log.test.mjs (7 passed), query-gate and query-gate-pipes all pass, wait-poll 36.

## History
- [2026-11-17 19:22] (created) bug — query-gate one-file-search blocks 'tail -n 0 -F target/broker/finished.log | grep --line-buffered -E <run ids>' in a Monitor: the documented
