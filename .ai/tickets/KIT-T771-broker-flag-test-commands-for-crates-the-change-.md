---
id: KIT-T771
title: broker: flag test commands for crates the change does not reach in the job result, and record each flagged command's pass or fail in the timing profile (KIT-Q005 lever 2 option A, KIT-D121)
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-D121]
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:44:14Z
updated: 2026-10-31T16:52:07Z
---

## Description
KIT-Q005 resolution (2): advisory flags first, auto-skip only once the flagged runs are shown never to fail. KIT-D121: get the times down, not stop long work. The result names test commands whose crates the change does not reach (result-summary), and the timing profile records passed or failed per flagged command. The skip is NOT built.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T765, KIT-T729, KIT-T649
Built: timing-reach.mjs (reachOf, outsideReach, outsideReachOf, reachBases), timing-cmd.mjs (cratesOf/targetsOf moved out of timing-sample); wasteOf adds a 'flagged' entry '<crates> <targets> passed|failed' beside the scope waste; the profile ranks 'flagged' but keeps it out of the ticketed top; broker blockers prints it; result-summary notes each out-of-reach command as advisory. No skip built. Evidence: timing-flagged 3 + timing-* 28 passed. dirt-empire 24 h read: 8 flagged rows, 7 passed, 1 failed (rg-synth --test low_weight, 0.9 min).

## History
- [2026-10-31 16:44] (created) feature — broker: flag test commands for crates the change does not reach in the job result, and record each flagged command's pass or fail in the timing profile (KIT-Q005 lever 2 option A, KIT-D121)
- [2026-10-31 16:44] (status) todo → doing
- [2026-10-31 16:52] (status) doing → review
