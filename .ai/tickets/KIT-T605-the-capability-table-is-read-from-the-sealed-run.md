---
id: KIT-T605
title: The capability table is read from the sealed runtime's copy of .ai/config.yml, so a re-date (data) needs a full publish:runtime before dispatch-guard sees it
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T05:08:00Z
updated: 2026-10-21T08:03:24Z
fixed_commit: c0759fe
---

## Description
ladderRoot() resolves to the directory of the running script, so hooks run from the sealed runtime read a frozen table. A stale-row block therefore outlives the fix by a 20+ minute publish. Read the table from the kit checkout (data) while keeping code sealed.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T433, KIT-T419, KIT-T339
2026-10-21: still open. The re-date only reached dispatch-guard after a full publish:runtime (about 1.5 h on a loaded machine).

## History
- [2026-10-21 05:08] (created) bug — The capability table is read from the sealed runtime's copy of .ai/config.yml, so a re-date (data) needs a full publish:runtime before dispatch-guard sees it
- [2026-10-21 08:03] (status) todo → review
- [2026-10-21 08:03] (comment) scripts/kit-data.mjs + kit-data.test.mjs (6 passed); a sealed-copy check read the checkout HEAD instead of the copy's own 2020 dates; takes effect once published
