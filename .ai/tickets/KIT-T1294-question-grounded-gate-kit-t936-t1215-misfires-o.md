---
id: KIT-T1294
title: question-grounded gate (KIT-T936/T1215) misfires on loose word overlap: a bill-of-work questionnaire ('Collect hand-backs only', 'Tree tidy
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T04:04:37Z
updated: 2026-11-16T04:13:04Z
---

## Description
question-grounded gate (KIT-T936/T1215) misfires on loose word overlap: a bill-of-work questionnaire ('Collect hand-backs only', 'Tree tidy first') was blocked citing RDG-T033 (fly probe camera), RDG-T072 (chunk building), RDG-T061/T034 (trees/vegetation), none related to the options. Gate should match on the item's subject, not shared common words (hand-backs, tidy, tree/files). Seen road-generator 2026-11-15.

kit-bug-shape: cap:bug:question-grounded-gate-kit-t936-t1215-misfires-o:5247c501
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Label matcher (hooks/lib/question-grounding.mjs) now needs GROUNDED_MIN_DISTINCT distinctive shared stems (df <= 15% of store docs, new lib/stem-rarity.mjs, also used by the clause matcher) or a label whose 3+ stems all sit in the title. Real road-generator store (184 docs): 'Collect hand-backs only' and 'Tree tidy first' now match nothing (were RDG-T033, T072, T061, T034). Tests: hooks/question-grounded-common-words.test.mjs 7 passed; question-grounded-gate 37, question-clause-precision 10, question-brief-gate 27, ids-described-gate 17, reask-gate 15 passed. brief-grounded (KIT-T703, hooks/dispatch-brief.mjs) has no word matching: it fires on any feature/request ticket ID written in the brief with no [maintainer-words:] token, so example 2 was an ID citation, not overlap; unchanged, raised in the hand-back.

## History
- [2026-11-16 04:04] (created) bug — question-grounded gate (KIT-T936/T1215) misfires on loose word overlap: a bill-of-work questionnaire ('Collect hand-backs only', 'Tree tidy
- [2026-11-16 04:13] (status) todo → review
