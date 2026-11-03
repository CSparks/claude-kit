---
id: KIT-T848
title: q code --dir D:/dev/stiletto-2349 ran past 120 s on a sibling checkout (dirt-empire 2026-11-03, DE-T295 analyst); q from inside the Stiletto
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T02:10:18Z
updated: 2026-11-03T16:31:43Z
---

## Description
q code --dir D:/dev/stiletto-2349 ran past 120 s on a sibling checkout (dirt-empire 2026-11-03, DE-T295 analyst); q from inside the Stiletto checkout answers in seconds. --dir scans of another repo must be fast or refuse with a pointer, and never leave a background job.

kit-bug-shape: cap:bug:q-code-dir-d-dev-stiletto-2349-ran-past-120-s-on
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --dir on a git checkout answers from its index in under a second (stiletto-2349 0.35 s, was past 120 s); a plain dir scan stops at 20 s with a notice; q-code-target 8 passed

## Plan
1.

## Notes
Cause: --dir walked and stat/opened every file of a sibling repo (47k files incl. target/) in the caller. Now a dir inside a git work tree and not ignored is answered from that checkout's code index (q-dir-target.mjs, absolute paths); gitignored/plain dirs are scanned with a 20 s / 50k-file budget, build dirs (target, .venv, __pycache__) below the target are named not entered, and a cut-short scan always prints a STOPPED notice. The resident server no longer takes --dir/--repo/outside --path (it would block its queue).

## History
- [2026-11-03 02:10] (created) bug — q code --dir D:/dev/stiletto-2349 ran past 120 s on a sibling checkout (dirt-empire 2026-11-03, DE-T295 analyst); q from inside the Stiletto
- [2026-11-03 16:23] (status) todo → doing
- [2026-11-03 16:31] (comment) criterion added: q code --dir on a git checkout answers from its index in under a second (stiletto-2349 0.35 s, was past 120 s); a plain dir scan stops at 20 s with a notice; q-code-target 8 passed
- [2026-11-03 16:31] (comment) ticked: q code --dir on a git checkout answers from its index in under a second (stiletto-2349 0.35 s, was past 120 s); a plain dir scan stops at 20 s with a notice; q-code-target 8 passed
- [2026-11-03 16:31] (status) doing → review
