---
id: KIT-T784
title: query-gate and store-shell-gate refuse commands for ambiguous quoting: a heredoc commit message containing an apostrophe, and a t comment wh
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T349
superseded_by:
created: 2026-11-01T15:52:26Z
updated: 2026-11-01T19:41:09Z
---

## Description
query-gate and store-shell-gate refuse commands for ambiguous quoting: a heredoc commit message containing an apostrophe, and a t comment whose text held escaped quotes, were blocked as possible store writes or searches. Seen 2026-11-01 in marblequest and claude-kit sessions; forced workarounds via scratchpad files.

kit-bug-shape: cap:bug:query-gate-and-store-shell-gate-refuse-commands-
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Also: broker-wait-gate treats the quoted arguments of data commands (git, t, cap, q, node script.mjs) as data (hooks/lib/command-leads.mjs withoutDataArguments); $(...) in them and bash -c code still block. hooks/broker-wait-gate.test.mjs 68 passed. Related suites: source-shell-gate 130, branch-guard 46, upstream-gate 38, python-stdin-gate 53, tree-delete-gate 27, wait-poll 26, broker-log-gate 19, shell-writes 7 passed.

## History
- [2026-11-01 15:52] (created) bug — query-gate and store-shell-gate refuse commands for ambiguous quoting: a heredoc commit message containing an apostrophe, and a t comment wh
- [2026-11-01 19:41] (status) todo → review
