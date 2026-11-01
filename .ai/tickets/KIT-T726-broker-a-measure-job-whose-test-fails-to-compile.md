---
id: KIT-T726
title: broker: a --measure job whose test fails to COMPILE reports status 'measured' (looks like success) instead of a compile failure, and the sub
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T09:07:37Z
updated: 2026-10-30T09:32:06Z
---

## Description
broker: a --measure job whose test fails to COMPILE reports status 'measured' (looks like success) instead of a compile failure, and the submit precheck did not catch the compile error. dirt-empire j-mvuqqlf0-2ejy7e (DE-T238, root lane, --measure --test 'cargo t -p dirt-empire --test app loading_glyphs'): error E0433 (missing derive_paths import for derive(Resource)) yet the monitor/result showed 'measured'. Expected: precheck cargo-checks the named test target and refuses; failing that, the result status is failed/compile-error, never 'measured'. Cost: one wasted ~10 min diagnosis cycle.

kit-bug-shape: cap:bug:broker-a-measure-job-whose-test-fails-to-compile
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: precheck.mjs skipped every --measure job (job.measure), so narrowCheck's already-correct '--lib --test app' never ran. Fix: precheck covers measure jobs; measure.mjs ends a command with cargo 'error: could not compile' as status compile-error (STATUS.BUILD_ERROR, not a red run) with the first rustc errors in message. Tests: scripts/broker/measure-build.test.mjs (3), precheck.test.mjs, measure.test.mjs, precheck-guards/scope (32 passed); npm run publish:runtime green, 194 files, runtime 8995b3a.
Committed 741409c (the earlier runtime 8995b3a did not contain the fix; publish exports HEAD). publish:runtime green at 741409c.

## History
- [2026-10-30 09:07] (created) bug — broker: a --measure job whose test fails to COMPILE reports status 'measured' (looks like success) instead of a compile failure, and the sub
- [2026-10-30 09:32] (status) todo → review
- [2026-10-30 16:22] (landed) 741409c broker: a --measure job whose command does not compile ends compile-error and is prechecked at submit; a submit waits fo
