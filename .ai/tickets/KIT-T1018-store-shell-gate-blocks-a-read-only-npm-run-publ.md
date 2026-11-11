---
id: KIT-T1018
title: store-shell-gate blocks a read-only 'npm run publish:runtime | grep -vE pattern | tail' as an ambiguous-quoting .ai store write: the pattern
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:46:44Z
updated: 2026-11-11T05:02:53Z
fixed_commit: 9c4abae
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

## Notes
Root cause: shell-segments flagged any dollar sign directly before a quote as a dollar-quote string, so a grep pattern ending in a dollar (the closing quote of a caret-s-star-dollar pattern) made the whole line ambiguous, and the ambiguous path blocks on any write token such as a greater-than in a second grep pattern. Fix in hooks/lib/shell-segments.mjs (not store-shell-gate.mjs): a dollar-quote is a quote OPENED right after a dollar sign. Tests: hooks/store-shell-gate.test.mjs 44 passed (filter pipe passes; store redirect, store rm and a real dollar-quote string still block), hooks/shell-segments.test.mjs 44 passed. Importer suites run green: source-shell-gate 168, escapes 11, query-gate all pass, tree-delete-gate 27, upstream-gate 38, branch-guard 46, broker-log-gate 19, wait-poll 28, hand-write-detect 69, shell-write-scan 54. Commit 9c4abae. Not published: HEAD suite is red on hooks/claim-release-controls.test.mjs, which imports the untracked hooks/lib/live-claims.mjs of another session.

## History
- [2026-11-11 04:46] (created) bug — store-shell-gate blocks a read-only 'npm run publish:runtime | grep -vE pattern | tail' as an ambiguous-quoting .ai store write: the pattern
- [2026-11-11 05:02] (landed) 9c4abae shell-segments: only a quote opened right after a dollar sign is a dollar-quote ambiguity, so a grep pattern ending in a
- [2026-11-11 05:02] (status) todo → review
