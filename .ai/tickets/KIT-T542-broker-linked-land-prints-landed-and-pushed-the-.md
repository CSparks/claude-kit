---
id: KIT-T542
title: broker linked land prints 'landed and pushed; the rapid-game half ... did not' when nothing landed
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:51Z
updated: 2026-10-16T16:18:27Z
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
### comment #1 [2026-10-16 16:18] @claude
Fixed (see commit below): landLinked returns the landCommits error unchanged when no submodule half was pushed. Tests: linked-nothing-landed.test.mjs 2 passed (the refused-push case red before; the control with a pushed half still names it), linked.test.mjs unchanged; broker glob 301 passed.

## History
- [2026-10-16 14:57] (created) bug — broker linked land prints 'landed and pushed; the rapid-game half ... did not' when nothing landed
- [2026-10-16 16:18] (comment) @claude: Fixed (see commit below): landLinked returns the landCommits error unchanged when no submodule half was pushed. Tests: l (full comment #1 in ## Notes)
- [2026-10-16 16:18] (status) todo → review
