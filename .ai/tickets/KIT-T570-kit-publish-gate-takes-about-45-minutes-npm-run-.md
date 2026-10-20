---
id: KIT-T570
title: Kit publish gate takes about 45 minutes (npm run publish:runtime runs the whole npm test at HEAD, KIT-T533). Chris 2026-10-19: nothing shoul
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T02:09:00Z
updated: 2026-10-19T02:09:00Z
---

## Description
Kit publish gate takes about 45 minutes (npm run publish:runtime runs the whole npm test at HEAD, KIT-T533). Chris 2026-10-19: nothing should take 45 minutes, anything over 2 minutes needs a reason, and this is concerning. Profile where the time goes (per test file wall clock, serial git-fixture tests, sleeps/timeouts that wait on a clock, repeated fixture setup), then shard/parallelise/trim so the publish gate is under about 5 minutes without dropping coverage. Seen 2026-10-19 while publishing KIT-T568.

kit-bug-shape: cap:bug:kit-publish-gate-takes-about-45-minutes-npm-run-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 02:09] (created) bug — Kit publish gate takes about 45 minutes (npm run publish:runtime runs the whole npm test at HEAD, KIT-T533). Chris 2026-10-19: nothing shoul
