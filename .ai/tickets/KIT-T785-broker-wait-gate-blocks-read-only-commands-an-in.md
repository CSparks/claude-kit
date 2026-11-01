---
id: KIT-T785
title: broker-wait gate blocks read-only commands: an inline node -e loop that only reads broker results files, and a tail of a node script output,
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T15:52:29Z
updated: 2026-11-01T19:41:11Z
---

## Description
broker-wait gate blocks read-only commands: an inline node -e loop that only reads broker results files, and a tail of a node script output, were blocked. Seen 2026-11-01 by the kit agent in claude-kit.

kit-bug-shape: cap:bug:broker-wait-gate-blocks-read-only-commands-an-in
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: broker-wait-gate treats a counted loop as a poll only around a broker call; waits and until/while loops (not while-read) stay polls around a broker call or broker state; quoted arguments of data commands are data (also in wait-poll). Tests: hooks/broker-wait-gate.test.mjs 68 passed incl. read-only broker-state negatives and wait/while-true/for-wait.mjs controls; hooks/wait-poll.test.mjs 28 passed. The tail-of-node-output case did not reproduce on the old regex; pinned as a passing negative.

## History
- [2026-11-01 15:52] (created) bug — broker-wait gate blocks read-only commands: an inline node -e loop that only reads broker results files, and a tail of a node script output,
- [2026-11-01 19:41] (status) todo → review
