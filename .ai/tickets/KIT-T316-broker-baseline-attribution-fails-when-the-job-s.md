---
id: KIT-T316
title: broker baseline attribution fails when the job's test filter names a test binary that only the patch adds: nextest at base exits 'operator d
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T22:23:59Z
updated: 2026-10-03T22:28:41Z
---

## Description
broker baseline attribution fails when the job's test filter names a test binary that only the patch adds: nextest at base exits 'operator didn't match any binary names' (stiletto job j-musy7ux2-dxyz4w, filter included binary(no_module_repeats_its_crate_name), a new file), so the other failing tests in the same command get no base result and are not marked foreign/pre-existing. The base re-run should drop binary()/test() terms that match nothing at base (or run per binary) so pre-existing failures are still attributed.

kit-bug-shape: cap:bug:broker-baseline-attribution-fails-when-the-job-s
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] baseline re-run drops the job's own nextest filter so a binary only the patch adds cannot break base attribution

## Plan
1.

## History
- [2026-10-03 22:23] (created) bug — broker baseline attribution fails when the job's test filter names a test binary that only the patch adds: nextest at base exits 'operator d
- [2026-10-03 22:28] (comment) criterion added: baseline re-run drops the job's own nextest filter so a binary only the patch adds cannot break base attribution
- [2026-10-03 22:28] (comment) ticked: baseline re-run drops the job's own nextest filter so a binary only the patch adds cannot break base attribution
- [2026-10-03 22:28] (comment) @sonnet55: baselineCommand strips the job's -E/--filterset and uses only the failed-test filter. Tests: scripts/broker/attribute.te (full comment #1 in ## Notes)
### comment #1 [2026-10-03 22:28] @sonnet55
baselineCommand strips the job's -E/--filterset and uses only the failed-test filter. Tests: scripts/broker/attribute.test.mjs (14; new: patch-only binary dropped, one filter, quoted/--filterset= forms, no-filter and libtest unchanged); mutation (no strip) fails the new test. Broker suite 92 passed.
- [2026-10-03 22:28] (status) todo → review
