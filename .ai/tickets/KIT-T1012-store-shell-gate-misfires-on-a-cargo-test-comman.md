---
id: KIT-T1012
title: store-shell-gate misfires on a cargo test command piped through grep -vE with regex alternations (no .ai path in the command): 'Ambiguous sh
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:15:49Z
updated: 2026-11-11T18:59:52Z
---

## Description
store-shell-gate misfires on a cargo test command piped through grep -vE with regex alternations (no .ai path in the command): 'Ambiguous shell quoting' block

kit-bug-shape: cap:bug:store-shell-gate-misfires-on-a-cargo-test-comman
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Reproduced against 9c4abae^: read-only cargo test 2>&1 | grep -vE patterns ending in a dollar blocked as may write the store; root cause is the KIT-T1018 dollar-quote misread, fixed in 9c4abae (live since runtime f5f0129). Residual fixed in ab38144: an ambiguous-quoting scan counted the greater-than of 2>&1, >&2 and a /dev/null redirect as a write token; HARMLESS_REDIRECT now strips those, any redirect to a real path still blocks (store-shell-gate tests 52 incl. 4 controls).

## History
- [2026-11-11 04:15] (created) bug — store-shell-gate misfires on a cargo test command piped through grep -vE with regex alternations (no .ai path in the command): 'Ambiguous sh
- [2026-11-11 18:59] (status) todo → review
