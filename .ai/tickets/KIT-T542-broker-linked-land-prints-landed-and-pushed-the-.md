---
id: KIT-T542
title: broker linked land prints 'landed and pushed; the rapid-game half ... did not' when nothing landed
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:51Z
updated: 2026-10-16T14:57:51Z
---

## Description
linked.mjs:84-86 writes '<blank> landed and pushed; the rapid-game half ... did not' when NOTHING landed (jobs 6v32f, 8fv1h, 8ikxg, 9e3pz, b6qyy, btan1 and live j-mvb2gdpy). Source: broker-vetting-2026-10-16 D4. Test: landLinked with no submodule halves and a failing landCommits errors without 'landed and pushed'.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T319, KIT-T488, KIT-T515

## History
- [2026-10-16 14:57] (created) bug — broker linked land prints 'landed and pushed; the rapid-game half ... did not' when nothing landed
