---
id: KIT-T448
title: Process failure (stiletto-2349-68, 2026-10-13): a /decide round re-asked Chris two questions (ST-Q016 graboids, ST-Q013 razed camps) that an
type: bug
status: done
priority: critical
asked: 2
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T19:46:26Z
updated: 2026-10-27T22:27:25Z
---

## Description
Process failure (stiletto-2349-68, 2026-10-13): a /decide round re-asked Chris two questions (ST-Q016 graboids, ST-Q013 razed camps) that another live session (stiletto-2349-2a) had already asked and he had answered there. Root cause: an open question file has no 'asked' / 'answered elsewhere' state and no cross-session check before a questionnaire fires; the answer lived only in the other session's chat, never written to the question file's Resolution, so q open showed both as open. Fix at the kit: (1) a question lifecycle event 'asked <session> <date>' stamped by the tool that renders a questionnaire from question files (/decide), visible in q show/q open; (2) a pre-questionnaire gate that lists questions already asked by another session in the last N days and blocks re-asking without --re-ask; (3) the answering session must write the Resolution the turn it is answered (flush hook nag when a questionnaire result exists and the matching question file is still open).

kit-bug-shape: cap:bug:process-failure-stiletto-2349-68-2026-10-13-a-de
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 19:46] (created) bug — Process failure (stiletto-2349-68, 2026-10-13): a /decide round re-asked Chris two questions (ST-Q016 graboids, ST-Q013 razed camps) that an
- [2026-10-13 19:46] (comment) seen again in stiletto-2349: Process failure (stiletto-2349-68, 2026-10-13): a /decide round re-asked Chris two questions (ST-Q016 graboids, ST-Q013 razed camps) already asked and answered in another live session (stiletto-2349-2a). Root cause: a question file has no 'asked by <session>' state and no cross-session check before
- [2026-10-13 19:46] (asked again) 2026-10-13 — cap:bug:process-failure-stiletto-2349-68-2026-10-13-a-de
- [2026-10-13 20:34] (status) todo → review
- [2026-10-13 20:34] (comment) 99e643c 4f383a6 be22f11 eccf06c; scripts/question-asks.test.mjs hooks/reask-gate.test.mjs hooks/flush.test.mjs; npm test exit 0
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
