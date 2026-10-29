---
id: KIT-T690
title: Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:57:29Z
updated: 2026-10-29T00:46:19Z
---

## Description
Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge per unit/cell, pooled_instances, shared bakes/caches; one huge game crate compiles serially -> split by concern, ST-T414; broker train rules) were re-hit in Dirt Empire because nothing carries solved lessons forward. Root cause: lessons live in one game's docs/perf and tickets, not in the framework's rules, the new-poc template, or orient. Chris: 'ALL future projects need to carry this knowledge forward... It works against the whole framework pattern.' Fix: a framework lessons ledger every project's orient surfaces and briefs must cite; template carries the structure; gates enforce where measurable.

kit-bug-shape: cap:bug:process-failure-cross-project-2026-10-28-problem
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Kit-side scope (coordinator, Chris 2026-10-28), after the broker enforcement tickets KIT-T683..T688: (1) orient prints the framework's rapid-game/docs/LESSONS.md headings for a repo that uses the framework, like the framework contract; (2) rendering/perf/asset/streaming briefs must cite the lessons they apply, gated by a [lessons-checked: ...] tag the way ui-framework-first is; (3) new-poc scaffolds from the ledger's structure rules (multiple crates by concern from day one). Not built in this pass.
Built kit side: frameworks/rapid-game.md names its ledger (lessons: rapid-game/docs/LESSONS.md); hooks/lib/lessons.mjs; orient prints the ledger headings after the contract (FRAMEWORK LESSONS block, demotable in orient-budget); hooks/dispatch-lessons.mjs adds check lessons-checked: rendering/perf/asset/streaming briefs (patch-worker and generic writers; read-only researchers exempt) need [lessons-checked: L-.. ids defined in the ledger] or [lessons-checked: none apply: <why>]; skills/new-poc/SKILL.md reads the ledger first and verifies a by-concern crate layout (L-B01) before handing over. Tests: dispatch-lessons.test.mjs 12 passed, frameworks.test.mjs 11 passed. NOT done: the generator itself (rapid-game scripts/new-poc.mjs and templates/new-poc) lives in the framework repo and still has to emit by-concern crates; the skill splits a one-crate scaffold by hand until then.

## History
- [2026-10-28 22:57] (created) bug — Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge
- [2026-10-29 00:46] (status) todo → review
