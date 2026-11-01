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
Verified by the standing kit agent 2026-11-01: the implementing commit is d85eb23 on main (the same tree first pushed as 91541d9, mis-titled 'implements MAR-T035' because the marblequest-18 agent reused a scratchpad message file; the real MAR-T035 fix is marblequest 22a34d6). Re-ran broker-wait-gate 70, shell-segments 31, query-gate all pass, store-shell-gate 40, source-shell-gate 130, hand-write-detect 39, wait-poll 28, broker-log-gate 19, branch-guard 46, python-stdin-gate 53, tree-delete-gate 27, upstream-gate 38: 0 failed. Status review stands on that test evidence.

## History
- [2026-11-01 15:52] (created) bug — broker-wait gate blocks read-only commands: an inline node -e loop that only reads broker results files, and a tail of a node script output,
- [2026-11-01 19:41] (status) todo → review
- [2026-11-01 19:45] (landed) d85eb23 gates: quoted heredoc bodies and quoted arguments are inert data; read-only loops pass the wait gates (implements KIT-T7
