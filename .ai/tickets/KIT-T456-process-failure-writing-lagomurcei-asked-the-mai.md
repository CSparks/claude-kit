---
id: KIT-T456
title: Process failure (writing/lagomurcei): asked the maintainer to rule on Milo's death timing, already settled in canon.md:103 and restated in o
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T22:25:06Z
updated: 2026-10-03T22:25:06Z
---

## Description
Process failure (writing/lagomurcei): asked the maintainer to rule on Milo's death timing, already settled in canon.md:103 and restated in outline/season-3.md:38. Root cause: built a 'conflict' from truncated grep fragments (cut -c) without reading the surrounding lines; a stale 'leaning S3' label in one thread file was read as a live contradiction. Ground claims in full context before raising a decision.

kit-bug-shape: cap:bug:process-failure-writing-lagomurcei-asked-the-mai
first seen in lagomurcei. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-03 22:25] (created) bug — Process failure (writing/lagomurcei): asked the maintainer to rule on Milo's death timing, already settled in canon.md:103 and restated in o
- [2026-10-13 19:52] (comment) @sonnet55: Proposed fix (not built; for the maintainer) (full comment #1 in ## Notes)
- [2026-10-13 20:17] (comment) re-keyed KIT-T317 -> KIT-T456: two files carried KIT-T317 (KIT-T451); the other file keeps it

## Notes
### comment #1 [2026-10-13 19:52] @sonnet55
Proposed fix (not built; for the maintainer). Note: this id is shared with a second ticket, KIT-T317-broker-submit-mjs-no-patch (id collision, filed separately). The failure: a decision question raised from truncated grep fragments (cut -c) of a fact already settled in canon.md:103. The antidote is grounding, and the kit already has a question gate (hooks/question-gate.mjs). Proposal: the gate blocks an AskUserQuestion that claims a conflict between past facts unless the question carries a `[grounded: path:line]` token per cited fact and the transcript shows a Read (not a grep fragment) of that file this turn; plus one line in the global contract: 'a question about a past fact cites the line read in full context'. Cheap variant if the full gate is too heavy: only the contract line plus a q-side helper `q show`-style 'canon lookup' for writing projects. Decision needed: gate (recommended) or contract line only.
