---
id: KIT-T467
title: claude-kit npm test stalls at the concern-check step in a full run (2026-10-13, KIT-T464/T465 agent); the rest of the chain passes when run
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T03:28:58Z
updated: 2026-10-14T05:28:53Z
---

## Description
claude-kit npm test stalls at the concern-check step in a full run (2026-10-13, KIT-T464/T465 agent); the rest of the chain passes when run from that step on, so the hang is in concern-check or its fixture

kit-bug-shape: cap:bug:claude-kit-npm-test-stalls-at-the-concern-check-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 03:28] (created) bug — claude-kit npm test stalls at the concern-check step in a full run (2026-10-13, KIT-T464/T465 agent); the rest of the chain passes when run
- [2026-10-14 05:25] (comment) @claude: Fixed 9fcd9d7: suites hydrated the live registry's project stores (begin-task 6m36s, 7s with an empty registry); npm tes (full comment #1 in ## Notes)
### comment #1 [2026-10-14 05:25] @claude
Fixed 9fcd9d7: suites hydrated the live registry's project stores (begin-task 6m36s, 7s with an empty registry); npm test now runs via scripts/run-tests.mjs with a throwaway registry. Full npm test green (rc=0, 17m40s).
- [2026-10-14 05:28] (comment) @claude: Stall fixed in 9fcd9d7 (npm test on an empty throwaway registry; begin-task 6m36s -> 6.7s; full run ~25 -> 17m40s; npm t (full comment #2 in ## Notes)
### comment #2 [2026-10-14 05:28] @claude
Stall fixed in 9fcd9d7 (npm test on an empty throwaway registry; begin-task 6m36s -> 6.7s; full run ~25 -> 17m40s; npm test green rc=0 before and inside publish:runtime). The unreproduced broker pin/control and model-tag single failures are split to their own kit-bug capture.
- [2026-10-14 05:28] (status) todo → review
