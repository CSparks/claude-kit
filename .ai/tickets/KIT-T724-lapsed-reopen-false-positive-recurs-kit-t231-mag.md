---
id: KIT-T724
title: lapsed-reopen false positive recurs: KIT-T231 (magic-numbers pre-write gate .patch) reopened by the KIT-T700 capture (2026-10-29) and again
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T04:34:40Z
updated: 2026-10-30T21:34:55Z
---

## Description
lapsed-reopen false positive recurs: KIT-T231 (magic-numbers pre-write gate .patch) reopened by the KIT-T700 capture (2026-10-29) and again by the KIT-T723 capture (2026-10-30) on generic shared words (gate, blocks, files, write); findLapsedMatches needs a distinctive-term floor, not title-coverage on common words

kit-bug-shape: cap:bug:lapsed-reopen-false-positive-recurs-kit-t231-mag
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Could not reproduce with current code: T723's text shares 5/9 title terms with KIT-T231 (<0.75), so the 04:26 reopen predates a fixed runtime or came from a different text. Hardened anyway: findLapsedMatches now requires >=2 shared terms that are rare among the store's ticket titles (<=2% of titles; gate/files/write/blocks are not). Evidence: scripts/review-lapse.test.mjs 15 passed incl. generic-title negative control and distinctive-title positive control.

## History
- [2026-10-30 04:34] (created) bug — lapsed-reopen false positive recurs: KIT-T231 (magic-numbers pre-write gate .patch) reopened by the KIT-T700 capture (2026-10-29) and again
- [2026-10-30 04:34] (comment) seen again in claude-kit: lapsed-reopen false positive recurs: KIT-T231 (magic-numbers pre-write gate .patch) reopened by the KIT-T700 capture (2026-10-29) and again by the KIT-T723 capture (2026-10-30) on generic shared words (gate, blocks, files, write); findLapsedMatches needs a distinctive-term floor, not title-coverage
- [2026-10-30 04:34] (asked again) 2026-10-30 — cap:bug:lapsed-reopen-false-positive-recurs-kit-t231-mag
- [2026-10-30 21:34] (status) todo → review
- [2026-10-30 21:34] (landed) aaa5acc Lapsed-reopen needs two distinctive shared terms, not only title coverage; implements KIT-T724
