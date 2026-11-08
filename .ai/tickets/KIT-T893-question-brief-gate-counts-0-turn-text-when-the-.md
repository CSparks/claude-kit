---
id: KIT-T893
title: question-brief-gate counts 0 turn text when the brief was sent in an earlier reply that also carried the failing AskUserQuestion call; 3 res
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T17:50:35Z
updated: 2026-11-08T18:47:53Z
---

## Description
question-brief-gate counts 0 turn text when the brief was sent in an earlier reply that also carried the failing AskUserQuestion call; 3 resends blocked in stiletto-2349 on 2026-11-08

kit-bug-shape: cap:bug:question-brief-gate-counts-0-turn-text-when-the-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] every assistant text and narration block since the last real maintainer message is counted, including narration blocks preceding Bash calls and turns opened by a task notification (hooks/question-brief-narration.test.mjs 8 passed)

## Plan
1.

## Notes
Root cause (from the stiletto-2349 11b75d60 transcript, entries 430/442/447): Claude Code records the commentary it shows between tool calls as a thinking block whose signature decodes to a protobuf holding the string narration and whose thinking text is filled; ordinary thinking blocks have empty text (12522 empty vs 1044 narration across all local transcripts, none other). turnText counted type text only, so every narration block was dropped and the gate counted up to the last real text block ('Still blocked'). Fix: hooks/lib/turn-text.mjs counts text blocks plus narration blocks (non-empty text and a narration signature); private thinking never counts. Likely the same cause as the KIT-T865/T872 'brief sat in a thinking block' cases. Tests: question-brief-narration 8 passed (negative control with the marker broken: 3 passed 5 failed), question-brief-gate 41, question-brief-turn 16, question-brief-sections 14, question-gate pass.

## History
- [2026-11-08 17:50] (created) bug — question-brief-gate counts 0 turn text when the brief was sent in an earlier reply that also carried the failing AskUserQuestion call; 3 res
- [2026-11-08 18:45] (comment) criterion added: every assistant text and narration block since the last real maintainer message is counted, including narration blocks preceding Bash calls and turns opened by a task notification (hooks/question-brief-narration.test.mjs 8 passed)
- [2026-11-08 18:45] (comment) ticked: every assistant text and narration block since the last real maintainer message is counted, including narration blocks preceding Bash calls and turns opened by a task notification (hooks/question-brief-narration.test.mjs 8 passed)
- [2026-11-08 18:45] (landed) d81ed6d question-brief-gate: narration blocks (thinking blocks signed narration, the commentary the maintainer sees between tool
- [2026-11-08 18:47] (status) todo → review
