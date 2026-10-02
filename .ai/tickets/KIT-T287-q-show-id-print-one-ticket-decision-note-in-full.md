---
id: KIT-T287
title: q show <id>: print one ticket/decision/note in full (frontmatter, criteria, notes, history) from any store, so reading an item never needs cat on .ai files — first q-gap, hit 2026-10-02 ('q: unknown query show')
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:58:59Z
updated: 2026-10-02T16:02:09Z
---

## Description
scripts/q-show.mjs: q show <id> looks in the project store (tickets, archive, decisions, notes, questions, inbox, epics), the adopted framework stores, then every registered project, and prints the file under a path header; a miss is one line. Tests: scripts/q.test.mjs KIT-T287 block (8 cases, store per case incl. archive and framework; q.test 102 passed).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q show <id> resolves ids across the project and framework stores and prints the item; test per store

## Plan
1.

## History
- [2026-10-02 15:58] (created) feature — q show <id>: print one ticket/decision/note in full (frontmatter, criteria, notes, history) from any store, so reading an item never needs cat on .ai files — first q-gap, hit 2026-10-02 ('q: unknown query show')
- [2026-10-02 15:59] (comment) criterion added: q show <id> resolves ids across the project and framework stores and prints the item; test per store
- [2026-10-02 16:02] (comment) ticked: q show <id> resolves ids across the project and framework stores and prints the item; test per store
- [2026-10-02 16:02] (status) todo → review
