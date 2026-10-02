---
id: KIT-T281
title: Weekly documentation + directory-structure review, alongside the weekly memory review: SessionStart nag when due, runs doc-audit and the structure audit over the project (and its adopted framework), presents grouped findings for the maintainer to act on, records the review timestamp
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-T282]
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:08:12Z
updated: 2026-10-02T15:35:25Z
---

## Description
Per-project stamp ~/.claude/.doc-review/<root> (hooks/lib/doc-review.mjs, mtime like the memory review, machine-local); housekeeping SessionStart nags DOC + STRUCTURE REVIEW DUE when the stamp is missing or 7+ days old and the repo has source (tree walk only runs once due). scripts/doc-review.mjs prints one grouped list: doc-tree lint plus structure audit for the project and each adopted framework tree, points to the doc-audit skill for stale references; --done records the review. Tests: hooks/housekeeping.test.mjs (40/40, six new nag cases: never, fresh, 8d, 6d, no-source, per-project), scripts/doc-review.test.mjs (3). Full suite via per-command runner: 69 ok; 2 pre-existing environment failures not from this work (scripts/agent-pins.test.mjs: untracked agents/implementer.md absent from plugin.json; server/server.test.mjs: express not installed).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Housekeeping reminder fires weekly per project, same mechanism as MEMORY REVIEW DUE
- [x] The review runs doc-audit (stale/orphan/duplicate docs, broken links) and the structure audit, and presents one grouped findings list
- [x] Test: the nag fires when the timestamp is older than 7 days and not otherwise

## Plan
1.

## History
- [2026-10-02 15:08] (created) feature — Weekly documentation + directory-structure review, alongside the weekly memory review: SessionStart nag when due, runs doc-audit and the structure audit over the project (and its adopted framework), presents grouped findings for the maintainer to act on, records the review timestamp
- [2026-10-02 15:08] (comment) criterion added: Housekeeping reminder fires weekly per project, same mechanism as MEMORY REVIEW DUE
- [2026-10-02 15:08] (comment) criterion added: The review runs doc-audit (stale/orphan/duplicate docs, broken links) and the structure audit, and presents one grouped findings list
- [2026-10-02 15:08] (comment) criterion added: Test: the nag fires when the timestamp is older than 7 days and not otherwise
- [2026-10-02 15:35] (comment) ticked: Housekeeping reminder fires weekly per project, same mechanism as MEMORY REVIEW DUE
- [2026-10-02 15:35] (comment) ticked: The review runs doc-audit (stale/orphan/duplicate docs, broken links) and the structure audit, and presents one grouped findings list
- [2026-10-02 15:35] (comment) ticked: Test: the nag fires when the timestamp is older than 7 days and not otherwise
- [2026-10-02 15:35] (status) todo → review
