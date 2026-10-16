---
id: KIT-T525
title: broker stop and stop --now do not end a daemon whose current work is the deferred foreign-test suite run (inflight id 'deferred'): root daem
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T18:43:00Z
updated: 2026-10-16T14:58:50Z
---

## Description
broker stop and stop --now do not end a daemon whose current work is the deferred foreign-test suite run (inflight id 'deferred'): root daemon 64436 (d008eaa) answered 'will exit within one poll' to both and was still alive 150 s later with the suite's cargo running; the operator had to kill the process to restart onto the published runtime 0211268. stop --now must interrupt the suite run (kill its command, restore the journal) and exit; plain stop should at least report that it waits for the suite

kit-bug-shape: cap:bug:broker-stop-and-stop-now-do-not-end-a-daemon-who
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 18:43] (created) bug — broker stop and stop --now do not end a daemon whose current work is the deferred foreign-test suite run (inflight id 'deferred'): root daem
- [2026-10-16 14:58] (comment) @claude: Implementing commit 80bbdb8 (stop cancels a running deferred/suite run at once; stop --now kills the command tree, resto (full comment #1 in ## Notes)
### comment #1 [2026-10-16 14:58] @claude
Implementing commit 80bbdb8 (stop cancels a running deferred/suite run at once; stop --now kills the command tree, restores the journal, exits; stop-running 3 passed incl. control, mutation-checked). c055f7f/b50ff51/c77da5b are load-tolerance test widenings. Status drift fixed: todo -> review.
- [2026-10-16 14:58] (status) todo → review
