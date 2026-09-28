---
id: KIT-T276
title: Decide the future of the broker-worker skill and build broker under KIT-D074: its workers edit in worktrees on lane branches, which branch-guard and dispatch-guard now block
type: tech-debt
status: todo
priority: medium
milestone:
labels: [dispatch, broker]
links: [KIT-D074, KIT-T270, KIT-D071]
files: [skills/broker-worker/SKILL.md, docs/BROKER.md, scripts/broker/]
supersedes:
superseded_by:
created: 2026-09-28T15:32:04Z
updated: 2026-09-28T15:32:04Z
---

## Description
The build broker (KIT-T270, `scripts/broker/`) and its `broker-worker` skill have workers
edit in `git worktree add … -b lane/<ticket>` checkouts dispatched with `isolation: worktree`.
KIT-D074 (one checkout on main, 2026-09-28) makes `branch-guard` block the worktree add and
lane branch, and `dispatch-guard` block every worktree dispatch in every project. The
maintainer has NOT retired the broker: the skill and scripts stay as they are until he
decides. Today they are unusable without `[maintainer-asked-worktree:]` /
`[maintainer-asked-branch:]` escapes.

## Acceptance Criteria
- [ ] The maintainer's decision (retire, rework to a single-checkout model, or keep as an explicitly-asked exception) is recorded as a decision file.
- [ ] The skill, `docs/BROKER.md` and `scripts/broker/` match that decision; the kit suite passes.

## Plan
1. Put the options to the maintainer in one questionnaire.

## History
- [2026-09-28 15:32] (created) tech-debt — Decide the future of the broker-worker skill and build broker under KIT-D074: its workers edit in worktrees on lane branches, which branch-guard and dispatch-guard now block
