---
id: KIT-T739
title: broker-wait-gate counts a wait.mjs call that never ran (node failed MODULE_NOT_FOUND from an unquoted path with a space in HOME) as the job'
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T23:19:07Z
updated: 2026-10-30T23:25:21Z
---

## Description
broker-wait-gate counts a wait.mjs call that never ran (node failed MODULE_NOT_FOUND from an unquoted path with a space in HOME) as the job's one wait, so the real wait is then blocked as polling

kit-bug-shape: cap:bug:broker-wait-gate-counts-a-wait-mjs-call-that-nev
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed 1f9dc40 + cba8230 (plugin 0.1.27): new PostToolUseFailure hook hooks/broker-wait-release.mjs forgets the wait/submit the gate counted when the failure text shows the script never started (Cannot find module, command not found). Cause: an unquoted $HOME path with a space parsed as a broker call at PreToolUse, then node failed. Test: hooks/broker-wait-release.test.mjs 9 passed; broker-wait-gate 48, plugin-compat 136 passed. cap itself prints 'filed <id>' on every path (scripts/cap.mjs:249-263): a worker that saw no id had a cap call that never ran (same unquoted-path failure); not verified from its transcript.

## History
- [2026-10-30 23:19] (created) bug — broker-wait-gate counts a wait.mjs call that never ran (node failed MODULE_NOT_FOUND from an unquoted path with a space in HOME) as the job'
- [2026-10-30 23:19] (comment) seen again in dirt-empire: broker-wait-gate counts a wait.mjs call that never ran (node failed MODULE_NOT_FOUND from an unquoted path with a space in HOME) as the job's one wait, so the real wait is then blocked as polling
- [2026-10-30 23:19] (asked again) 2026-10-30 — cap:bug:broker-wait-gate-counts-a-wait-mjs-call-that-nev
- [2026-10-30 23:23] (landed) 1f9dc40 broker-wait-release: a wait or submit whose script never started (unquoted path with a space, missing module) is forgott
- [2026-10-30 23:24] (landed) cba8230 codex plugin 0.1.27: matches the Claude manifest version (plugin-compat 136 passed) (implements KIT-T739)
- [2026-10-30 23:25] (status) todo → review
