---
id: KIT-T675
title: broker: a cargo job fails 'failed to remove file target/debug/<bin>.exe: Access is denied (os error 5)' with no retry and no record of the h
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T20:29:36Z
updated: 2026-10-28T22:33:39Z
---

## Description
broker: a cargo job fails 'failed to remove file target/debug/<bin>.exe: Access is denied (os error 5)' with no retry and no record of the holder (dirt-empire 2026-10-28 ~16:55-17:00Z, j-mvscv05f/j-mvscwfrm; the game was NOT open, the agent guessed it was). Retry after a short back-off and log the holding process (handle/Get-Process by path) so the cause is known (Defender scan of a fresh link, a stray test-spawned exe).

kit-bug-shape: cap:bug:broker-a-cargo-job-fails-failed-to-remove-file-t
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A cargo command failing 'failed to remove file ... Access is denied (os error 5)' is retried after 1/3/8 s backoff and the log names the process holding the file (file-lock.test.mjs)

## Plan
1.

## Notes
Tests: scripts/broker/file-lock.test.mjs 5 passed (+ link-recover.test.mjs 3 passed); holder lookup checked live against the real Win32_Process query.

## History
- [2026-10-28 20:29] (created) bug — broker: a cargo job fails 'failed to remove file target/debug/<bin>.exe: Access is denied (os error 5)' with no retry and no record of the h
- [2026-10-28 22:18] (comment) criterion added: A cargo command failing 'failed to remove file ... Access is denied (os error 5)' is retried after 1/3/8 s backoff and the log names the process holding the file (file-lock.test.mjs)
- [2026-10-28 22:18] (comment) ticked: A cargo command failing 'failed to remove file ... Access is denied (os error 5)' is retried after 1/3/8 s backoff and the log names the process holding the file (file-lock.test.mjs)
- [2026-10-28 22:33] (status) todo → review
