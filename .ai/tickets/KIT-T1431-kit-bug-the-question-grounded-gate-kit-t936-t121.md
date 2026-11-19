---
id: KIT-T1431
title: Kit bug: the question-grounded gate (KIT-T936/T1215) refused three questionnaires in a row on 2026-11-19 by matching unrelated decisions on
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T20:24:30Z
updated: 2026-11-19T20:36:20Z
---

## Description
Kit bug: the question-grounded gate (KIT-T936/T1215) refused three questionnaires in a row on 2026-11-19 by matching unrelated decisions on generic words. A question about lifting the one-writer usage limit was matched to RDG-D121 (Rust best-practices sweep), RDG-D123, RDG-D032 (away-mode), RDG-D060 (quiet-machine measurements), RDG-D124 and RDG-D063 on words like check, run, work, writer, open, road, agent, fix, test, several, parallel (scores 2.3 to 5.3), forcing a citation of each in turn and never accepting the options-checked tag that cited the two truly relevant decisions (RDG-D052, RDG-D137). Wanted: score only on rare or project-specific words (at least 3 distinct rare words, stop-word list for generic engineering verbs and nouns), accept an options-checked tag that cites the truly relevant ids and says the others do not apply, and print which words matched.

kit-bug-shape: cap:bug:kit-bug-the-question-grounded-gate-kit-t936-t121:01899dc4
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix: hooks/lib/generic-stems.mjs (check, run, work, time, usage, once, parallel, agent, test, several, point, road, fix, performance, ... as optionStems stems) is dropped from every stem set of the label and clause matchers. A clause restatement needs GROUNDED_CLAUSE_MIN_RARE = 3 distinct rare stems and the score 2.2. New tag [options-checked: <ids> govern this; the other matches do not apply: <why>] (TOKENS.optionsCheckedIds) raises the bar to TAGGED_BAR (5 rare stems, score 3.5): a near-verbatim restatement of an uncited decision still blocks. The block prints matched words per decision and shared words per option label. Tests: hooks/question-grounded-generic-words.test.mjs 16 passed (real 2026-11-19 case: RDG-D121/D123/D032/D060/D124/D063 do not block, RDG-D052 and RDG-D137 suggested; control RDG-D063 restatement blocks, also with the ids tag); question-grounded-gate 37, common-words 7, clause-precision 10, gate-protocol 57, question-brief-blocked 8, t-decide-dedup 15, t-decide 14, contract-rules 48 passed.

## History
- [2026-11-19 20:24] (created) bug — Kit bug: the question-grounded gate (KIT-T936/T1215) refused three questionnaires in a row on 2026-11-19 by matching unrelated decisions on
- [2026-11-19 20:36] (status) todo → review
