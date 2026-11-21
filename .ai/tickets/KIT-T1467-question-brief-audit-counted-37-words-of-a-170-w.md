---
id: KIT-T1467
title: question-brief audit counted 37 words of a 170-word summary: commentary beside a tool call is stored as a shortened copy
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T893, KIT-T1465]
files: []
supersedes:
superseded_by:
created: 2026-11-21T15:58:29Z
updated: 2026-11-21T15:58:57Z
---

## Description
The owner's coordinator wrote a summary of about 170 words above a questionnaire; the after-the-call audit counted 37 because Claude Code stores commentary written beside a tool call as a shortened platform copy (a narration block) and the full text is not in the transcript. Same family as the narration-counts fix (KIT-T893).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a shortened narration copy of a long summary is accepted at 20 words; reply text keeps 40; the audit prints the counted text and explains the shortening (question-brief-narration 19 passed)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T893, KIT-T1465, KIT-T1448
Measured on a real transcript: a message with a text block is recorded whole (352 words), while a message whose pre-call commentary became a narration block is recorded as a 39 to 56 word copy; the block's signature is an opaque 1.8 KB blob, not the text, so the full text is NOT recoverable from the transcript (checked: no other entry holds it). Built instead: (1) a summary the transcript holds only as that narration copy is judged at 20 words, not 40 (hooks/lib/question-brief.mjs BRIEF_MIN_NARRATION_WORDS); reply text keeps the 40-word bar; (2) the audit prints up to 400 characters of every counted block, with its kind and word count, and a note that explains the shortening and what to do; (3) the standing-rules questionnaire line (block and all 15 agent definitions) and the global protocol say to write the summary as reply text, not commentary, directly above the call, and to repeat it on a resend. Tests: hooks/question-brief-narration.test.mjs 19 passed (37-word copy passes, same 37 words as reply text fail, 19 vs 20 boundary, counted text printed), question-brief-blocked 12, -audit 22, -turn 22, -gate 27, rule-block 31, contract-rules 48.

## History
- [2026-11-21 15:58] (created) bug — question-brief audit counted 37 words of a 170-word summary: commentary beside a tool call is stored as a shortened copy
- [2026-11-21 15:58] (comment) criterion added: a shortened narration copy of a long summary is accepted at 20 words; reply text keeps 40; the audit prints the counted text and explains the shortening (question-brief-narration 19 passed)
- [2026-11-21 15:58] (comment) ticked: a shortened narration copy of a long summary is accepted at 20 words; reply text keeps 40; the audit prints the counted text and explains the shortening (question-brief-narration 19 passed)
- [2026-11-21 15:58] (status) todo → review
