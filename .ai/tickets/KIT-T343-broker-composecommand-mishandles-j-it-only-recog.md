---
id: KIT-T343
title: broker composeCommand mishandles -j: it only recognises '-j'/'--jobs' as separate tokens, so a '-j2' in --test or verify_default gets a seco
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T06:30:06Z
updated: 2026-10-06T06:30:06Z
---

## Description
broker composeCommand mishandles -j: it only recognises '-j'/'--jobs' as separate tokens, so a '-j2' in --test or verify_default gets a second '-j 3' appended and cargo errors; it also appends '--no-fail-fast -j 3' AFTER a trailing '-- <args>' so the flags go to the test binary. Seen by three patch-workers on dirt-empire 2026-10-06 (jobs j-muw98zpr, j-muw931xs, j-muw93fvw). Also: a test that fails identically with and without the patch (vehicle_dynamics full_lock gate) was NOT marked foreign, so full-suite landings had to be narrowed or --skip'd.

kit-bug-shape: cap:bug:broker-composecommand-mishandles-j-it-only-recog
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 06:30] (created) bug — broker composeCommand mishandles -j: it only recognises '-j'/'--jobs' as separate tokens, so a '-j2' in --test or verify_default gets a seco
