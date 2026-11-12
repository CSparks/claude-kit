---
id: KIT-T1102
title: ids-described-gate misfire 2026-11-12 road-generator: a questionnaire option read 'the settlement access work (off-ramps and on-ramps into s
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T18:16:27Z
updated: 2026-11-12T18:23:12Z
---

## Description
ids-described-gate misfire 2026-11-12 road-generator: a questionnaire option read 'the settlement access work (off-ramps and on-ramps into settlements, RDG-T024)' and was blocked as naming RDG-T024 without saying what it is. The ticket title is 'Settlements are cut off from the highways: no off-ramp or on-ramp leads from a motorway into a settlement's streets'. The description shares settlements/settlement, off-ramp(s), on-ramp(s) with the title; the matcher appears not to stem plurals or to split or keep hyphenated words. Wanted: plural and hyphen tolerant matching of distinctive title words, a test with this exact pair passing, and the block message printing which title words it looked for and found.

kit-bug-shape: cap:bug:ids-described-gate-misfire-2026-11-12-road-gener
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
hooks/lib/stems.mjs: plural cut to singular (ies to y, trailing s), hyphenated or possessive word counted joined and as parts (off-ramps ~ off-ramp ~ offramp). hooks/ids-described-gate.mjs: block prints looked-for title words and found words. Tests: ids-described-gate 17 passed (exact RDG-T024 pair passes, singular form passes, bare id still blocks, message lists looked/found words, stems unit), gate-protocol 42 passed. Commit f7fb367.

## History
- [2026-11-12 18:16] (created) bug — ids-described-gate misfire 2026-11-12 road-generator: a questionnaire option read 'the settlement access work (off-ramps and on-ramps into s
- [2026-11-12 18:22] (landed) f7fb367 ids-described-gate: title words match plural and hyphenated (off-ramps/off-ramp, settlements/settlement); the block prin
- [2026-11-12 18:23] (status) todo → review
