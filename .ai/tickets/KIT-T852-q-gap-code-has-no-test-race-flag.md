---
id: KIT-T852
title: q gap: 'code' has no --test race flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T04:19:29Z
updated: 2026-11-03T16:31:39Z
---

## Description
q code --test race

kit-bug-shape: q-gap:flag:code:--test race
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code|sym|file --test keeps only test files, --not-test drops them; q-code-target 8 passed

## Plan
1.

## Notes
q code --test (--tests) / --not-test (--not-tests): test = tests/test/__tests__/spec dir or test_x, x_test, x.test.*, x.nodetest.*, x.spec.* file (q-test-path.mjs). Agents typed 'q code ... --test race' meaning 'race in test files'; the flag now does that.

## History
- [2026-11-03 04:19] (created) bug — q gap: 'code' has no --test race flag
- [2026-11-03 16:23] (status) todo → doing
- [2026-11-03 16:31] (comment) criterion added: q code|sym|file --test keeps only test files, --not-test drops them; q-code-target 8 passed
- [2026-11-03 16:31] (comment) ticked: q code|sym|file --test keeps only test files, --not-test drops them; q-code-target 8 passed
- [2026-11-03 16:31] (status) doing → review
- [2026-11-03 16:31] (landed) 3b98a14 q code: --test/--not-test, --repo, --dir on a git checkout answers from its index (sibling repo 0.35 s, was past 120 s),
