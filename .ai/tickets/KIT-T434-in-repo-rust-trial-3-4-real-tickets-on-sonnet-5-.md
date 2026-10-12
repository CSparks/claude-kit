---
id: KIT-T434
title: In-repo Rust trial: 3-4 real tickets on Sonnet 5.5 vs Opus 5.5 at medium effort, compare pass rate and tokens
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T21:10:07Z
updated: 2026-10-12T21:10:07Z
---

## Description
The 2026-10-12 capability research (research/models-capability-2026-10-12.md, Gaps) found no source testing Rust, spatial or geometry work, large-context degradation on 5.5, or briefs written by a stronger model. Close the gap in our own repos: run 3-4 real Rust tickets, each as an exhaustive apply brief (file:line, exact change, test, acceptance), once on Sonnet 5.5 and once on Opus 5.5 at medium effort. Compare pass rate (tests green, no re-derivation), tokens per landing and wall time; record the result per job in the next research/models-capability-<date>.md and move the build/refactor rows only on that evidence. Chris approved the plan-then-apply verdicts 2026-10-12 (KIT-D091); this trial was offered in the same questionnaire and is recorded as a todo.
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
- [ ] 3-4 real Rust tickets chosen from stiletto-2349 / rapid-game, each with an exhaustive apply brief
- [ ] each ticket run on Sonnet 5.5 and Opus 5.5 (medium effort), results in the outcome ledger
- [ ] pass rate, tokens per landing and wall time recorded in a research/models-capability-<date>.md table
- [ ] build and refactor rows confirmed or moved on that evidence

## Plan
1.

## History
- [2026-10-12 21:10] (created) feature — In-repo Rust trial: 3-4 real tickets on Sonnet 5.5 vs Opus 5.5 at medium effort, compare pass rate and tokens
