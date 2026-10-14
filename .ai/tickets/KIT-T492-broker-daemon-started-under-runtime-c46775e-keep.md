---
id: KIT-T492
title: broker daemon started under runtime c46775e keeps calling that pruned dir's hooks/pre-write.mjs: every job fails 'gate crash: Cannot find mo
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T20:32:23Z
updated: 2026-10-14T22:01:24Z
---

## Description
broker daemon started under runtime c46775e keeps calling that pruned dir's hooks/pre-write.mjs: every job fails 'gate crash: Cannot find module ...c46775e/hooks/pre-write.mjs' until restarted (stiletto-2349, pid 45236, job j-mv8kfnt9-qil4bv). Daemon should resolve hooks via the 'current' runtime link or restart when its runtime dir vanishes.

kit-bug-shape: cap:bug:broker-daemon-started-under-runtime-c46775e-keep
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 20:32] (created) bug — broker daemon started under runtime c46775e keeps calling that pruned dir's hooks/pre-write.mjs: every job fails 'gate crash: Cannot find mo
- [2026-10-14 22:01] (comment) @claude: Covered by KIT-T486 (5cb8c3a, landed 20:40Z after this was filed at 20:32Z): gate.mjs reports runtime-gone and the daemo (full comment #1 in ## Notes)
### comment #1 [2026-10-14 22:01] @claude
Covered by KIT-T486 (5cb8c3a, landed 20:40Z after this was filed at 20:32Z): gate.mjs reports runtime-gone and the daemon restarts itself from current when its runtime dir vanishes. The stiletto daemon pid 45236 predates it. Restarts now also go through launch.mjs (KIT-T496).
- [2026-10-14 22:01] (status) todo → review
