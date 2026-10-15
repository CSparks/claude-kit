---
id: KIT-T518
title: Broker resumes an interrupted test run instead of restarting it: after a stop, crash or watchdog kill mid-test, the restart reruns only the tests that had not yet passed (nextest results recorded as they finish, rerun filtered to the remainder), so a half-done 20-min run is not thrown away
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:28:15Z
updated: 2026-10-15T19:14:28Z
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
### comment #2 [2026-10-15 19:14] @claude
Done in b4d0a99 (pushed). scripts/broker/test-record.mjs: the interrupted nextest command's streamed PASS lines become a per-job record under the broker home (testrun/<job>.json); the restart reruns with --no-tests=pass -E not (passes), ANDed with the command's own filterset; a changed tree state, patch or commands discards the record. Deviation from the ticket text: outcomes come from nextest's human PASS lines in the log, not libtest-json/JUnit (JUnit is written only at run end; libtest-json is experimental), same data, survives a kill. Not covered: trains, suite runs, plain cargo test. Tests: test-record.test.mjs 6 passed (fake nextest of 6 tests killed after 3, restart runs the other 3; changed command and moved HEAD run all 6; unit cases for the filter), 60 neighbouring broker tests passed.

## History
- [2026-10-15 17:28] (created) feature — Broker resumes an interrupted test run instead of restarting it: after a stop, crash or watchdog kill mid-test, the restart reruns only the tests that had not yet passed (nextest results recorded as they finish, rerun filtered to the remainder), so a half-done 20-min run is not thrown away
- [2026-10-15 17:28] (comment) @claude: Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from ze (full comment #1 in ## Notes)
- [2026-10-15 19:14] (comment) @claude: Done in b4d0a99 (pushed). scripts/broker/test-record.mjs: the interrupted nextest command's streamed PASS lines become a (full comment #2 in ## Notes)
- [2026-10-15 19:14] (status) todo → review
