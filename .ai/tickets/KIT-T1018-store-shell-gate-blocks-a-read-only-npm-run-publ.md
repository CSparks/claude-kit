---
id: KIT-T1018
title: store-shell-gate blocks a read-only 'npm run publish:runtime | grep -vE pattern | tail' as an ambiguous-quoting .ai store write: the pattern
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:46:44Z
updated: 2026-11-11T04:46:44Z
---

## Description
store-shell-gate blocks a read-only 'npm run publish:runtime | grep -vE pattern | tail' as an ambiguous-quoting .ai store write: the pattern holds backslash-s and a caret-dollar alternation, no store path is named; same family as KIT-T979 (source-shell-gate misfire on read-only grep with escapes)

kit-bug-shape: cap:bug:store-shell-gate-blocks-a-read-only-npm-run-publ
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:46] (created) bug — store-shell-gate blocks a read-only 'npm run publish:runtime | grep -vE pattern | tail' as an ambiguous-quoting .ai store write: the pattern
