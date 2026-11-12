---
id: KIT-T1095
title: process failure 2026-11-12 (road-generator main thread): two plan drafts for flyover performance proposed new mechanisms (per-tier reach ins
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: [KIT-T1085, KIT-T690]
files: []
supersedes:
superseded_by:
created: 2026-11-12T15:58:09Z
updated: 2026-11-12T16:18:32Z
fixed_commit: 6b5725a
---

## Description
process failure 2026-11-12 (road-generator main thread): two plan drafts for flyover performance proposed new mechanisms (per-tier reach inside rg-flora, a view-detail resource, nested ground) while the framework already has the stage ladder with per-stage rings, residency lanes, rg-landform far/mid/near rings, the headless streamer and the chunk editor; RDG-D016 already orders framework-first. Chris had to point it out: 'I said multiple times to use what is there so that we can tune it.' Root cause: the plan was grounded on the crates the demo already calls (rg-flora, rg-scatter) and never on docs/CRATES.md and the rg-chunk-stream / rg-worldgen surface, so a need was designed before the framework index was read. Prevention: a plan or design brief for a rapid-game project cites the CRATES.md rows and crate surfaces it checked for each mechanism it proposes (a [framework-checked: ...] gate on plan-mode exit and plan dispatches), and orient replays RDG-D016's rule for the session.

kit-bug-shape: cap:bug:process-failure-2026-11-12-road-generator-main-t
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A plan leaving plan mode (ExitPlanMode) and a plan or design dispatch in a repo with a rapid-game crate index need [framework-checked: ...]: dispatch-framework.test.mjs 24 passed
- [x] q gates agent and q gates plan print the tag form; orient prints a FRAMEWORK FIRST line: gate-protocol.test.mjs 39 passed, gate-digest.test.mjs 9 passed

## Plan
1.

## Notes
Overlap check: KIT-T1085 wants a pre-write gate on creating a new crate under the framework ([reuses:]/CHOICES citation) - different trigger (a file creation), not built (todo, no landed commit); KIT-T690 built the lessons ledger and lessons-checked, which covers LESSONS.md ids and rendering/perf briefs, never CRATES.md or plans. Neither specifies this prevention, so it is built here by reusing the lessons-checked/rulings-checked pattern (gate-tokens.mjs token, one dispatch-*.mjs check, gate-protocol entry); linked both. Built: hooks/lib/framework-first.mjs (index parse, citation test, orient line, block text), hooks/dispatch-framework.mjs (check framework-checked, shared by the dispatch guard and the plan-exit hook), hooks/plan-exit-gate.mjs (PreToolUse ExitPlanMode, reads tool_input.plan), frameworks/rapid-game.md front matter crates: rapid-game/docs/CRATES.md, orient FRAMEWORK FIRST block (never demoted), q gates plan, q gates agent entry, contract checklist clause. The citation must name a crate the index lists, or none apply with a reason. A dispatch is asked when job plan or an analyst/researcher is briefed with design words (isDesignDispatch, same as rulings-checked). ExitPlanMode hookability: the harness documents PreToolUse matching on ExitPlanMode with tool_input.plan; the hook is registered in hooks.json and unit-tested with that payload, but not yet seen firing live (hooks load at session start). Tests: dispatch-framework.test.mjs 22 passed, gate-protocol.test.mjs 39 passed, gate-digest.test.mjs 9 passed (budget 12 to 14 lines for the new plan gate), dispatch-lessons 19, dispatch-conformance 11, dispatch-rulings 13, dispatch-guard.test.mjs, contract-rules 17, frameworks.test 13 all green. Negative controls: no-framework repo, framework repo with no index file, non-design brief, empty plan, ignore file.

## History
- [2026-11-12 15:58] (created) bug — process failure 2026-11-12 (road-generator main thread): two plan drafts for flyover performance proposed new mechanisms (per-tier reach ins
- [2026-11-12 16:00] (comment) seen again in road-generator: process failure 2026-11-12 (road-generator main thread): an AskUserQuestion named RDG-T016 and RDG-T015 by bare id in the question and option text; ids-described-gate blocked it (KIT-D128). Root cause: the orchestrator did not run 'q gates question' before its questionnaire (KIT-D147) and wrote tick
- [2026-11-12 16:00] (asked again) 2026-11-12 — cap:bug:process-failure-2026-11-12-road-generator-main-t
- [2026-11-12 16:08] (comment) criterion added: A plan leaving plan mode (ExitPlanMode) and a plan or design dispatch in a repo with a rapid-game crate index need [framework-checked: ...]: dispatch-framework.test.mjs 24 passed
- [2026-11-12 16:08] (comment) criterion added: q gates agent and q gates plan print the tag form; orient prints a FRAMEWORK FIRST line: gate-protocol.test.mjs 39 passed, gate-digest.test.mjs 9 passed
- [2026-11-12 16:09] (comment) ticked: A plan leaving plan mode (ExitPlanMode) and a plan or design dispatch in a repo with a rapid-game crate index need [framework-checked: ...]: dispatch-framework.test.mjs 24 passed
- [2026-11-12 16:09] (comment) ticked: q gates agent and q gates plan print the tag form; orient prints a FRAMEWORK FIRST line: gate-protocol.test.mjs 39 passed, gate-digest.test.mjs 9 passed
- [2026-11-12 16:09] (landed) 6b5725a framework-checked: a plan leaving plan mode and a plan or design dispatch in a repo with a framework crate index cite th
- [2026-11-12 16:18] (status) todo → review
