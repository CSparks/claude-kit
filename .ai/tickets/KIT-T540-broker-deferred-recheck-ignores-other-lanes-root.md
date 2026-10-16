---
id: KIT-T540
title: broker deferred recheck ignores other lanes: root idle check reads only its own lane queue while all lanes share one CARGO_TARGET_DIR
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:38Z
updated: 2026-10-16T15:23:17Z
---

## Description
deferred.mjs:52 and :65 read only the own lane's queue/inflight. Root recheck contends with rapid-game lane builds (j-mvb2gdpy-9f0fj9-0.log line 1: 'Blocking waiting for file lock on artifact directory'). Extends KIT-T310 (own-lane yield) to every lane sharing the target dir. Source: broker-vetting-2026-10-16 D2. Test: with any lane's queue or inflight non-empty the root recheck does not start.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T310, KIT-T482, KIT-T539
### comment #1 [2026-10-16 15:23] @claude
Fixed in 99024c9 (pushed): lane-busy.mjs laneBusy gates start and cancel on every lane's queue and on another lane's real-job inflight; an unrun test updates head/dirty so it is judged once per trigger. Tests: recheck-idle.test.mjs 6 passed (3 red before the fix, 2 lane tests red before) incl. controls; broker glob 289 passed. Not covered: the root suite run (suite.mjs) keeps its own starvation rule and still ignores other lanes.

## History
- [2026-10-16 14:57] (created) bug — broker deferred recheck ignores other lanes: root idle check reads only its own lane queue while all lanes share one CARGO_TARGET_DIR
- [2026-10-16 15:23] (comment) @claude: Fixed in 99024c9 (pushed): lane-busy.mjs laneBusy gates start and cancel on every lane's queue and on another lane's rea (full comment #1 in ## Notes)
- [2026-10-16 15:23] (status) todo → review
