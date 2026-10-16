---
id: KIT-T540
title: broker deferred recheck ignores other lanes: root idle check reads only its own lane queue while all lanes share one CARGO_TARGET_DIR
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:38Z
updated: 2026-10-16T14:57:38Z
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

## History
- [2026-10-16 14:57] (created) bug — broker deferred recheck ignores other lanes: root idle check reads only its own lane queue while all lanes share one CARGO_TARGET_DIR
