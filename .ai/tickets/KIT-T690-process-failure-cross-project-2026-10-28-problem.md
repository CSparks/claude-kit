---
id: KIT-T690
title: Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:57:29Z
updated: 2026-10-28T22:57:29Z
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

## History
- [2026-10-28 22:57] (created) bug — Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge
