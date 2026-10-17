---
id: KIT-T558
title: broker: restore dirt it provably caused itself instead of pausing: an EOL-only leftover of a file a broker job wrote is put back from HEAD (written.mjs ledger, healOwnDirt); a hand edit or a file the broker never wrote still pauses untouched
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T20:39:23Z
updated: 2026-10-17T21:01:19Z
---

## Description
Chris 2026-10-17 questionnaire. Tests: scripts/broker/self-dirt.test.mjs.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T535, KIT-T482, KIT-T545, KIT-T553
scripts/broker/written.mjs: a ledger of journalled paths (recordWritten in preimage.capture) and healOwnDirt in dirtState: a tracked ' M' file in the ledger whose diff --ignore-cr-at-eol is empty is checked out from HEAD. scripts/broker/self-dirt.test.mjs 4 passed: EOL-only leftover restored and the queue runs; hand edit pauses untouched; EOL-only on a file no job wrote pauses; hand edit plus CRLF pauses.

## History
- [2026-10-17 20:39] (created) feature — broker: restore dirt it provably caused itself instead of pausing: an EOL-only leftover of a file a broker job wrote is put back from HEAD (written.mjs ledger, healOwnDirt); a hand edit or a file the broker never wrote still pauses untouched
- [2026-10-17 21:01] (status) todo → review
