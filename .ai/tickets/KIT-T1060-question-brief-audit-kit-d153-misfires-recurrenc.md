---
id: KIT-T1060
title: question-brief-audit (KIT-D153) misfires, recurrence of KIT-T893: marblequest 2026-11-11. The full summary (about 190 words: intro paragraph
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T17:16:02Z
updated: 2026-11-11T17:16:02Z
---

## Description
question-brief-audit (KIT-D153) misfires, recurrence of KIT-T893: marblequest 2026-11-11. The full summary (about 190 words: intro paragraph, 4 bullet lines, recommendation paragraph) was sent in the reply whose first AskUserQuestion was blocked by question-grounded-gate; the re-ask followed a one-line narration. The audit counted only 39 words (first paragraph of the earlier reply) and ignored the bullet list, the recommendation paragraph and the questionnaire's own question text (about 55 words) although its message says question text counts. Fix: count all text blocks of the turn since the last user message, bullets and later paragraphs included, plus question text; add a regression test with this shape. regressed_from KIT-T893.

kit-bug-shape: cap:bug:question-brief-audit-kit-d153-misfires-recurrenc
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause (marblequest transcript, entries 128-143): the reply before the blocked call is ONE 39-word narration block, the ~190 words never reached the transcript, and turnText reads every block (no split, bullet or cap bug). The Stop backstop (turnCalls) audited the hook-denied first call, which never reached the maintainer (its result is 'PreToolUse:AskUserQuestion hook error'), and the audit judged question text only as an alternative to prose; the re-ask audited clean. Fix (e63e11d): turnCalls marks denied calls and the audit skips them; prose plus question text is one count, reported in the Counted line. Tests: hooks/question-brief-blocked.test.mjs 8 passed (new; removing the skip fails 2), question-brief-audit 22, -turn 16, -narration 8, -gate 23, block-triage 13, question-grounded-gate 16 passed.

## History
- [2026-11-11 17:16] (created) bug — question-brief-audit (KIT-D153) misfires, recurrence of KIT-T893: marblequest 2026-11-11. The full summary (about 190 words: intro paragraph
- [2026-11-11 17:25] (landed) e63e11d question-brief audit skips a call a PreToolUse hook denied (never reached the maintainer) and counts the turn's prose pl
