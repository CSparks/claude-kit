---
id: KIT-T518
title: Broker resumes an interrupted test run instead of restarting it: after a stop, crash or watchdog kill mid-test, the restart reruns only the tests that had not yet passed (nextest results recorded as they finish, rerun filtered to the remainder), so a half-done 20-min run is not thrown away
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:28:15Z
updated: 2026-10-15T17:28:15Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T496, KIT-T498, KIT-T501
### comment #1 [2026-10-15 17:28] @claude
Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from zero (KIT-T518), Cargo.lock restore unproven (KIT-T519), a stale queued --pin moving a gitlink backwards (KIT-T515)).

## History
- [2026-10-15 17:28] (created) feature — Broker resumes an interrupted test run instead of restarting it: after a stop, crash or watchdog kill mid-test, the restart reruns only the tests that had not yet passed (nextest results recorded as they finish, rerun filtered to the remainder), so a half-done 20-min run is not thrown away
- [2026-10-15 17:28] (comment) @claude: Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from ze (full comment #1 in ## Notes)
