---
id: KIT-T300
title: broker failure attribution never runs for a nextest failure: diagnose.mjs files nextest's closing 'error: test run failed' line as an (unloc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T06:33:02Z
fixed_commit: b8a409a8603de3b5d1aa011c2254378f9fd75050
updated: 2026-10-03T06:36:35Z
---

## Description
broker failure attribution never runs for a nextest failure: diagnose.mjs files nextest's closing 'error: test run failed' line as an (unlocated) compile error, and attribute() returns null whenever command.errors is non-empty, so a test failure is never re-run on the pre-patch tree and pre-existing

kit-bug-shape: cap:bug:broker-failure-attribution-never-runs-for-a-next
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] nextest's 'error: test run failed' trailer is not a compile error: failing tests reach attribution; real rustc errors still block it

## Plan
1.

## History
- [2026-10-03 06:33] (created) bug — broker failure attribution never runs for a nextest failure: diagnose.mjs files nextest's closing 'error: test run failed' line as an (unloc
- [2026-10-03 06:36] (comment) criterion added: nextest's 'error: test run failed' trailer is not a compile error: failing tests reach attribution; real rustc errors still block it
- [2026-10-03 06:36] (comment) ticked: nextest's 'error: test run failed' trailer is not a compile error: failing tests reach attribution; real rustc errors still block it
- [2026-10-03 06:36] (status) todo → review
- [2026-10-03 06:36] (comment) @sonnet55: (fixed) b8a409a8603de3b5d1aa011c2254378f9fd75050

## Notes
Fix b8a409a8603de3b5d1aa011c2254378f9fd75050: RUN_TRAILER skip in scripts/broker/diagnose.mjs. Tests: scripts/broker/attribute.test.mjs (diagnose on nextest log: no errors, failed tests named; attribute runs a baseline; rustc-error negative control stays null). Mutation: fix reverted -> both new tests fail (8 pass / 2 fail); restored -> node --test "scripts/broker/*.test.mjs" 52 passed. Real log j-mus0fq4c-uv3z2a-0.log: errors {} and 2 failed tests named. Not changed: libtest trailers `error: test failed, to rerun pass ...` and `error: N target failed:` are the same defect for plain cargo test.
