---
id: KIT-T1424
title: compat-run-limit.test.mjs fails 7 checks (stdin never written / closed at once / spinning hook / hang) with ENOENT on <tmp>/kit-limit-*/hook
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T02:26:07Z
updated: 2026-11-19T02:26:07Z
---

## Description
compat-run-limit.test.mjs fails 7 checks (stdin never written / closed at once / spinning hook / hang) with ENOENT on <tmp>/kit-limit-*/hooks/hang.pid; fails identically in sealed runtime 9d9fa2b4, so it predates KIT-T1421

kit-bug-shape: cap:bug:compat-run-limit-test-mjs-fails-7-checks-stdin-n:0ef62941
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-19 02:26] (created) bug — compat-run-limit.test.mjs fails 7 checks (stdin never written / closed at once / spinning hook / hang) with ENOENT on <tmp>/kit-limit-*/hook
