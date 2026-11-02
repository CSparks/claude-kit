---
id: KIT-T817
title: Process failure: a questionnaire question cited a ticket by bare id (the KIT-T703 scope question) and the maintainer could not tell what it
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T23:40:08Z
updated: 2026-11-02T00:03:31Z
---

## Description
Process failure: a questionnaire question cited a ticket by bare id (the KIT-T703 scope question) and the maintainer could not tell what it was. Root cause: the rule that every id shown to the maintainer carries a plain-words description was never recorded, so nothing enforced it and it recurred. Fix: an AskUserQuestion gate that blocks a question or option text containing an item id (KEY-T###, KEY-D###, KEY-Q###) unless the same question also carries that item's description words (its title, or text that stands alone without the id); extend the Stop receipt check the same way.

kit-bug-shape: cap:bug:process-failure-a-questionnaire-question-cited-a
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 23:40] (created) bug — Process failure: a questionnaire question cited a ticket by bare id (the KIT-T703 scope question) and the maintainer could not tell what it
- [2026-11-02 00:03] (comment) @claude: Landed hooks/ids-described-gate.mjs (check ids-described) on AskUserQuestion beside reask-gate. Rule chosen: the title-w (full comment #1 in ## Notes)
### comment #1 [2026-11-02 00:03] @claude
Landed hooks/ids-described-gate.mjs (check ids-described) on AskUserQuestion beside reask-gate. Rule chosen: the title-word rule. Each id (KEY-T/D/Q###) in a question or its options is looked up (hooks/lib/item-title.mjs) and the same question must carry at least 2 of the title distinctive words; the id-removed-still-reads rule was rejected because the failing KIT-T703 question still read fine without its id. Unknown ids and parse errors pass. The Stop receipt extension is NOT done: a receipt is free prose, so judging whether an id sits beside a description needs its own parse; left for a follow-up. Tests: ids-described-gate.test.mjs 12 passed.
- [2026-11-02 00:03] (status) todo → review
