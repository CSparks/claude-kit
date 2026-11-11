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

## History
- [2026-11-11 17:16] (created) bug — question-brief-audit (KIT-D153) misfires, recurrence of KIT-T893: marblequest 2026-11-11. The full summary (about 190 words: intro paragraph
