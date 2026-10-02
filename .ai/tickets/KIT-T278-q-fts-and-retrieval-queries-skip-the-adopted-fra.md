---
id: KIT-T278
title: q fts and retrieval queries skip the adopted framework store
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:04:09Z
updated: 2026-10-02T15:10:05Z
---

## Description
Adopted framework = hooks/lib/frameworks.mjs frameworksFor (the FRAMEWORK CONTRACT source); its store = <submodule>/.ai keyed by ids.key (scripts/q-framework.mjs). Applied to fts (cache + markdown-scan parity). open/orphans/rundown deliberately stay project-only: pulling framework tickets into a game's drain board would mix queues; similar is already cross-scope. Verified live in stiletto: q fts sleep wake now returns RG-T117. Tests: scripts/q.test.mjs KIT-T278 block (2 fail before, 94 pass after).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q fts defaults to the project store plus adopted framework stores (same detector as orient), rows labelled by scope; --scope still confines

## Plan
1.

## History
- [2026-10-02 15:04] (created) bug — q fts and retrieval queries skip the adopted framework store
- [2026-10-02 15:10] (comment) criterion added: q fts defaults to the project store plus adopted framework stores (same detector as orient), rows labelled by scope; --scope still confines
- [2026-10-02 15:10] (comment) ticked: q fts defaults to the project store plus adopted framework stores (same detector as orient), rows labelled by scope; --scope still confines
- [2026-10-02 15:10] (status) todo → review
