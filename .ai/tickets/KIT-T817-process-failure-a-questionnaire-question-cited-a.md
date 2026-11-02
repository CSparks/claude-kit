---
id: KIT-T817
title: Process failure: a questionnaire question cited a ticket by bare id (the KIT-T703 scope question) and the maintainer could not tell what it
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T23:40:08Z
updated: 2026-11-01T23:40:08Z
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
