---
id: KIT-T835
title: id-integrity check blocks Stop on lapsed done regressions that have no fixed_commit
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T18:53:04Z
updated: 2026-11-02T18:53:04Z
---

## Description
A review-lapse close (KIT-D107) sets status done plus label lapsed with no fixing commit. The sync-data Stop hook's id-integrity check (findRegressionGaps) flagged 15 such archived regressions in stiletto-2349 (ST-T202, T295, T299, T300, T375, T400, T407, T411, T487, T491, T492, T506, T544, T547, T734) as 'done regression missing fixed_commit'. Fix: a lapsed done regression is exempt from the fixed_commit requirement; provenance links are still required.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
findRegressionGaps skips the fixed_commit gap when labels include lapsed (LAPSE_LABEL from t/lapse-rule.mjs); provenance link gaps still apply. Tests: scripts/id-utils.test.mjs 58 passed, hooks/sync-data.test.mjs 19, scripts/review-lapse.test.mjs 15. check-ids on D:/dev/stiletto-2349 is clean. No data backfill: git cannot prove a fixing commit for a lapse.

## History
- [2026-11-02 18:53] (created) bug — id-integrity check blocks Stop on lapsed done regressions that have no fixed_commit
