---
id: KIT-T502
title: broker tests leak patch-* fixture repos and detached auto-started daemons in %TEMP% (38 dirs, 6 live daemons)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T10:39:00Z
updated: 2026-10-15T15:04:46Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T500
### comment #2 [2026-10-15 23:28] @claude
KIT-T532 writer 2026-10-15: 110 broker-wt-* dirs sat in %TEMP% during the full npm test (dirs left by the broker and its tests, not the testkit). Still leaking after this ticket's fix; check whether broker-wt-* was in its scope.

## History
- [2026-10-15 10:39] (created) bug — broker tests leak patch-* fixture repos and detached auto-started daemons in %TEMP% (38 dirs, 6 live daemons)
- [2026-10-15 15:04] (comment) @claude: fixed in this commit: tests broker suite 241+ passed (npm test exit 0); testkit-leak.test.mjs / hydrate-sources.test.mjs / metrics.test.mjs / suite-starve.test.mjs / stop.test.mjs added with controls
- [2026-10-15 15:04] (status) todo → review
- [2026-10-15 23:28] (comment) @claude: KIT-T532 writer 2026-10-15: 110 broker-wt-* dirs sat in %TEMP% during the full npm test (dirs left by the broker and its (full comment #2 in ## Notes)
