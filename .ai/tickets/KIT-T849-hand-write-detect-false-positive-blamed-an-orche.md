---
id: KIT-T849
title: hand-write-detect false positive: blamed an orchestrator shell call (a q search) for source files that a broker landing (8b902d7, DE-T290) c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T02:13:10Z
updated: 2026-11-03T02:21:40Z
---

## Description
hand-write-detect false positive: blamed an orchestrator shell call (a q search) for source files that a broker landing (8b902d7, DE-T290) changed in the tree between snapshots; the tree is clean and committed. It must attribute only changes made during the call, ignoring HEAD moves by the broker, and must not block a commit afterwards.

kit-bug-shape: cap:bug:hand-write-detect-false-positive-blamed-an-orche
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-03 02:13] (created) bug — hand-write-detect false positive: blamed an orchestrator shell call (a q search) for source files that a broker landing (8b902d7, DE-T290) c
- [2026-11-03 02:19] (landed) 9ba3122 hand-write-detect: files a HEAD move (a broker landing) committed during a call are the landing's, not the call's; a lat
- [2026-11-03 02:21] (status) todo → review
- [2026-11-03 02:21] (comment) @claude: Fixed 9ba3122, runtime 9ba3122: hand-write-detect Pre records HEAD; Post ignores paths a HEAD move committed (clean now) (full comment #1 in ## Notes)
### comment #1 [2026-11-03 02:21] @claude
Fixed 9ba3122, runtime 9ba3122: hand-write-detect Pre records HEAD; Post ignores paths a HEAD move committed (clean now), so a broker landing is never ledgered or blocking a later commit. Real hand writes in the same call still flagged. Tests: hand-write-detect 44, source-shell-gate 130, shell-writes 7.
