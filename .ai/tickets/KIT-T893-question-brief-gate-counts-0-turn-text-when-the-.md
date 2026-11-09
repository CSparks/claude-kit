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
### Handoff a250066eb4f1d5972
- Jobs: none open. Publish runs: db2f606, ecad15b, cb3ea43, 4b02eb2 (current runtime 4b02eb2, suite passed). Last publish follow-up pid 48708 (log publish-followup.log in the runtime dir) ran 137 test files that did not fit the budget; read publish-followup.json before the next publish.
- State: narration counting (KIT-T893) stays; KIT-T906 added text-only replyHasText, a "Blocks read" listing, a narration note, and acceptance of a brief written in the questionnaire's own question text (703df8b, notes db2f606). Landed from the same hand-off: KIT-T908 publish.lock names its holder (ecad15b), KIT-T909 and KIT-T912 handback notices (bc81ba6), KIT-T913 named tests decide the broker verdict (13016f7), KIT-T914 precheck logs under logs/ and a 14-day sweep (6e57a5a), KIT-T911 untagged primary target verified plus unverified-dir alert (cb3ea43) and the sweep hold list with D:/dev/dirt-empire/target held (4b02eb2; hold file C:/Users/Chris Sparks/.claude/build-sweep-holds.txt).
- Next: (1) the KIT-D153 pass, gate files now committed (HEAD 4b02eb2): question-brief-gate checks only that a plain summary of reasonable length came first in the turn (narration or text, or the question text carries it); drop the exact-label and sentence-shape checks in hooks/lib/question-brief.mjs, hooks/lib/question-text.mjs, hooks/question-brief-gate.mjs; reconcile with the committed KIT-D152 audit files hooks/question-brief-audit.mjs, hooks/lib/question-audit.mjs, hooks/lib/question-audits.mjs, hooks/lib/orient/brief-misses.mjs; keep question-gate, ids-described, reask and question-ready. (2) Shrink `q gates question` (hooks/lib/gate-protocol.mjs) to summary then questionnaire. (3) Shrink the KIT-D129/D142/D146 questionnaire section of user-config/CLAUDE.global.md to one rule citing KIT-D153. (4) Update tests (exact-shape cases go; add plain summary passes, no summary fails, narration summary passes), publish, commit and push. (5) Unrelated untracked kit items seen in git status, not mine, left to their owners: .ai/tickets KIT-T831, T849, T857-T859, T862-T864, T866, T868-T871, T875-T878, T880, T883-T890, T892, T895, T900, T902, T903, T905; .ai/decisions KIT-D131, D133-D139, D142, D144, D145, D147-D151; .ai/reopened.jsonl; the archived tickets under .ai/tickets/archive; the other session's tracked .ai edits and deletions.
- Files: hooks/lib/turn-text.mjs, hooks/lib/assistant-text.mjs, hooks/lib/question-brief.mjs, hooks/lib/question-text.mjs, hooks/question-brief-gate.mjs, hooks/lib/gate-protocol.mjs, hooks/question-brief-labels.test.mjs, user-config/CLAUDE.global.md (not edited).

## History
- [2026-11-08 17:50] (created) bug — question-brief-gate counts 0 turn text when the brief was sent in an earlier reply that also carried the failing AskUserQuestion call; 3 res
- [2026-11-08 18:45] (comment) criterion added: every assistant text and narration block since the last real maintainer message is counted, including narration blocks preceding Bash calls and turns opened by a task notification (hooks/question-brief-narration.test.mjs 8 passed)
- [2026-11-08 18:45] (comment) ticked: every assistant text and narration block since the last real maintainer message is counted, including narration blocks preceding Bash calls and turns opened by a task notification (hooks/question-brief-narration.test.mjs 8 passed)
- [2026-11-08 18:45] (landed) d81ed6d question-brief-gate: narration blocks (thinking blocks signed narration, the commentary the maintainer sees between tool
- [2026-11-08 18:47] (status) todo → review
- [2026-11-08 18:49] (landed) 4f8f1f2 KIT-T893 to review; replay of the stiletto transcript at both blocked calls now passes [no-test: ticket store only] (imp
