---
id: KIT-T1424
title: compat-run-limit.test.mjs fails 7 checks (stdin never written / closed at once / spinning hook / hang) with ENOENT on <tmp>/kit-limit-*/hook
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T02:26:07Z
updated: 2026-11-19T02:43:14Z
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

## Notes
Cause: the test copied the launcher with a hand-kept list of lib files; compat-core.mjs gained an import of lib/gate-heartbeat.mjs (and through it lib/turn-state.mjs), so the copied launcher crashed at import before reading stdin and every timing check failed. Fix: the test copies the launcher's relative-import closure. hooks/compat-run-limit.test.mjs 14 passed.

## History
- [2026-11-19 02:26] (created) bug — compat-run-limit.test.mjs fails 7 checks (stdin never written / closed at once / spinning hook / hang) with ENOENT on <tmp>/kit-limit-*/hook
- [2026-11-19 02:43] (status) todo → review
