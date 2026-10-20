---
id: KIT-T551
title: t tick <ordinal> counts only UNTICKED criteria: after 't tick ST-T904 4', 't tick ST-T904 5' ticked criterion 6 and '6' ticked criterion 8 (
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T20:07:27Z
updated: 2026-10-16T21:03:04Z
fixed_commit: a5c43af
---

## Description
t tick <ordinal> counts only UNTICKED criteria: after 't tick ST-T904 4', 't tick ST-T904 5' ticked criterion 6 and '6' ticked criterion 8 (2026-10-16). Ordinals should be the criterion's printed position, or the CLI should refuse ambiguous ordinals and print the list.

kit-bug-shape: cap:bug:t-tick-ordinal-counts-only-unticked-criteria-aft
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 20:07] (created) bug — t tick <ordinal> counts only UNTICKED criteria: after 't tick ST-T904 4', 't tick ST-T904 5' ticked criterion 6 and '6' ticked criterion 8 (
- [2026-10-16 21:02] (comment) @claude: fixed a5c43af: scripts/criteria.mjs resolveSelector reads a numeric selector as the 1-based position among ALL the secti (full comment #1 in ## Notes)
### comment #1 [2026-10-16 21:02] @claude
fixed a5c43af: scripts/criteria.mjs resolveSelector reads a numeric selector as the 1-based position among ALL the section's criteria (the same indexing the web API uses) and refuses one that names a criterion already in the target state; substring selectors still search the eligible subset. Evidence: scripts/t.test.mjs 113 passed; the exact sequence tick 4, tick 5, tick 6 on a six-criterion ticket checks 4, 5 and 6 (red before: 'ordinal 6 out of range (1..4 open criteria)'); controls: tick 4 again is refused, untick 5 reopens the fifth. Behaviour change: three older checks in t.test.mjs that ticked 'ordinal 1' twice to tick two boxes now tick 1 then 2.
- [2026-10-16 21:03] (status) todo → review
- [2026-10-16 21:03] (comment) scripts/t.test.mjs 113 passed
