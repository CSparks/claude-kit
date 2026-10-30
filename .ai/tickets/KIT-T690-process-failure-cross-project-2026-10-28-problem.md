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
- [ ] Orient lists a project's unpromoted kit/framework decisions (KIT-D111): scripts/decision-promotion.mjs, decision-promotion.test.mjs 3 passed

## Plan
1.

## Notes
Kit-side scope (coordinator, Chris 2026-10-28), after the broker enforcement tickets KIT-T683..T688: (1) orient prints the framework's rapid-game/docs/LESSONS.md headings for a repo that uses the framework, like the framework contract; (2) rendering/perf/asset/streaming briefs must cite the lessons they apply, gated by a [lessons-checked: ...] tag the way ui-framework-first is; (3) new-poc scaffolds from the ledger's structure rules (multiple crates by concern from day one). Not built in this pass.
Built kit side: frameworks/rapid-game.md names its ledger (lessons: rapid-game/docs/LESSONS.md); hooks/lib/lessons.mjs; orient prints the ledger headings after the contract (FRAMEWORK LESSONS block, demotable in orient-budget); hooks/dispatch-lessons.mjs adds check lessons-checked: rendering/perf/asset/streaming briefs (patch-worker and generic writers; read-only researchers exempt) need [lessons-checked: L-.. ids defined in the ledger] or [lessons-checked: none apply: <why>]; skills/new-poc/SKILL.md reads the ledger first and verifies a by-concern crate layout (L-B01) before handing over. Tests: dispatch-lessons.test.mjs 12 passed, frameworks.test.mjs 11 passed. NOT done: the generator itself (rapid-game scripts/new-poc.mjs and templates/new-poc) lives in the framework repo and still has to emit by-concern crates; the skill splits a one-crate scaffold by hand until then.
### comment #1 [2026-10-29 20:33] @claude
Chris 2026-10-29: 'How are we going to enforce those optimizations on new projects going forward?' (after the DE-T233 parity audit found Dirt Empire missing five framework features Stiletto opts into: Vulkan pin, task-pool sizing, terrain split, stream lead, off-thread cell merge; see dirt-empire DE-N011, DE-D065, DE-D066). Enforcement plan: (1) framework defaults - the tuning is ON in rg-engine/rg-graphics/rg-chunk-stream and a game opts OUT explicitly; (2) a framework conformance test every game runs through rg-testkit (backend pinned, pools sized, pooled uploads active, streamed meshes under the upload cap, stream follows velocity, perf lint set inherited); (3) new-poc template scaffolds on the default-on app builder, inherits the lint set and ships the rg-probe-kit drive tour; (4) orient flags a game that bypasses a framework default (plain DefaultPlugins, no budget, position-only stream follow) the way 'FRAMEWORK OWNS THIS' flags local copies.
### comment #2 [2026-10-30 00:33] @claude
Chris 2026-10-30: the dev build profile was done correctly in Stiletto (framework crates in a fast dev tier, opt-level 1, debug line-tables-only; third-party at opt-level 3, debug 0; guard test workspace-guards/tests/dev_profile_covers_framework_crates.rs) and not in Dirt Empire: 'That shit needs re-enforcement.' Audit gap: the DE-T233 parity audit (DE-N011) compared framework features and never compared Cargo profiles, so every framework pin rebuilt the whole framework at opt-level 3. Built: (1) rg-testkit lint::dev_profile + conformance::assert_framework_conformance, one framework-owned guard every game calls from tests/framework_conformance.rs; (2) rapid-game scripts/dev-profile.mjs lists/writes the missing sections, new-poc emits them and the test; (3) kit scripts/framework-profile.mjs: orient FRAMEWORK DEV PROFILE (beside FRAMEWORK DEFAULT BYPASSED, via concernBlock) and FRAMEWORK CONFORMANCE NOT WIRED when a broker project lacks broker.affected.conformance; (4) lesson L-B03 in rapid-game docs/LESSONS.md; (5) rapid-game docs/PARITY_AUDIT.md: checklist row 2 compares Cargo profiles side by side. Tests: framework-profile.test.mjs 6 passed, dev-profile.nodetest.mjs 7 passed.

## History
- [2026-10-28 22:57] (created) bug — Process failure (cross-project, 2026-10-28): problems already litigated and solved in Stiletto (instance/entity count is a CPU cost -> merge
- [2026-10-29 00:46] (status) todo → review
- [2026-10-29 04:07] (comment) criterion added: Orient lists a project's unpromoted kit/framework decisions (KIT-D111): scripts/decision-promotion.mjs, decision-promotion.test.mjs 3 passed
- [2026-10-29 20:33] (comment) @claude: Chris 2026-10-29: 'How are we going to enforce those optimizations on new projects going forward?' (after the DE-T233 pa (full comment #1 in ## Notes)
- [2026-10-29 20:54] (landed) 898427c broker precheck: touched scripts must pass node --check, a cold precheck target never builds beside a running job; tree-
- [2026-10-30 00:33] (comment) @claude: Chris 2026-10-30: the dev build profile was done correctly in Stiletto (framework crates in a fast dev tier, opt-level 1 (full comment #2 in ## Notes)
