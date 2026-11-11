---
id: KIT-T937
title: dispatch-guard misfire 2026-11-10: a brief for a pure hook/gate fix (question-brief gate, kit checkout) was blocked by lessons-checked and c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T16:27:14Z
updated: 2026-11-10T18:08:29Z
---

## Description
dispatch-guard misfire 2026-11-10: a brief for a pure hook/gate fix (question-brief gate, kit checkout) was blocked by lessons-checked and conformance-named because the text said 'flora meshes' / 'foliage' / 'rocks' (fixture nouns), and by brief-grounded because it cited DE-T285 as a fixture id. The gates match nouns and ids anywhere in the brief, not the work being done; a brief whose [tree:] is the kit checkout (no game, no render crate) should not trip the framework lessons/conformance checks, and an id named as test-fixture data is not a build-this-ticket brief.

kit-bug-shape: cap:bug:dispatch-guard-misfire-2026-11-10-a-brief-for-a-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 9dcfc35; tests: hooks/dispatch-lessons.test.mjs hooks/dispatch-conformance.test.mjs hooks/dispatch-brief.test.mjs (negative controls included); standing kit agent adcd3ffd

## History
- [2026-11-10 16:27] (created) bug — dispatch-guard misfire 2026-11-10: a brief for a pure hook/gate fix (question-brief gate, kit checkout) was blocked by lessons-checked and c
- [2026-11-10 17:26] (landed) 9dcfc35 dispatch-guard: lessons-checked and conformance-named judge a brief by its [tree:] checkout's frameworks (the kit checko
- [2026-11-10 17:27] (status) todo → review
- [2026-11-10 18:08] (status) review → review
- [2026-11-10 18:21] (landed) 1548452 tickets: KIT-T906, T936, T937, T943, T944, T955 in review with landing notes, KIT-T948 reopened for the partial-commit c
