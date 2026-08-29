---
id: KIT-T256
title: dispatch-guard: ONE implementation agent at a time — block a second concurrent dispatch (any tree, hand-made worktrees included) unless [allow-parallel: N lanes, ~Xk tokens each, <reason>] states the cost; cold-build gate also fires on a prompt that names a hand-made worktree path (Chris 2026-08-25: four lanes at ~300-600k tokens each, full cold builds — 'One agent doing the work is faster than this bullshit. It needs to NEVER HAPPEN AGAIN WITH ENFORCEMENT')
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T176]
files: []
supersedes:
superseded_by:
created: 2026-08-25T20:59:00Z
updated: 2026-08-25T21:05:10Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] dispatch-guard gains parallel-dispatch: any in-flight roster row (any tree, worktree rows included, < 2h old) blocks a new dispatch unless the prompt carries [allow-parallel: N lanes, ~Xk tokens each, <why>]; a bare [allow-parallel: reason] still blocks and the message names the missing cost.
- [x] cold-worktree-build also fires when the brief NAMES a hand-made git worktree path (.git is a file) in a Cargo repo, not only on isolation:worktree.
- [x] Tests: hooks/dispatch-guard.test.mjs covers block/escape/bare-escape/finished/stale/ignore/corrupt-roster/hand-made-worktree; the three KIT-T177 tree-scoped allowances now assert shared-tree stays silent while parallel-dispatch blocks.
- [x] CLAUDE.global.md (kit source of the global contract) states the rule with the lived cost and the escape token.

## Plan
1.

## History
- [2026-08-25 20:59] (created) bug — dispatch-guard: ONE implementation agent at a time — block a second concurrent dispatch (any tree, hand-made worktrees included) unless [allow-parallel: N lanes, ~Xk tokens each, <reason>] states the cost; cold-build gate also fires on a prompt that names a hand-made worktree path (Chris 2026-08-25: four lanes at ~300-600k tokens each, full cold builds — 'One agent doing the work is faster than this bullshit. It needs to NEVER HAPPEN AGAIN WITH ENFORCEMENT')
- [2026-08-25 21:04] (comment) criterion added: dispatch-guard gains parallel-dispatch: any in-flight roster row (any tree, worktree rows included, < 2h old) blocks a new dispatch unless the prompt carries [allow-parallel: N lanes, ~Xk tokens each, <why>]; a bare [allow-parallel: reason] still blocks and the message names the missing cost.
- [2026-08-25 21:04] (comment) criterion added: cold-worktree-build also fires when the brief NAMES a hand-made git worktree path (.git is a file) in a Cargo repo, not only on isolation:worktree.
- [2026-08-25 21:04] (comment) criterion added: Tests: hooks/dispatch-guard.test.mjs covers block/escape/bare-escape/finished/stale/ignore/corrupt-roster/hand-made-worktree; the three KIT-T177 tree-scoped allowances now assert shared-tree stays silent while parallel-dispatch blocks.
- [2026-08-25 21:04] (comment) criterion added: CLAUDE.global.md (kit source of the global contract) states the rule with the lived cost and the escape token.
- [2026-08-25 21:05] (status) todo → doing
- [2026-08-25 21:05] (comment) ticked: dispatch-guard gains parallel-dispatch: any in-flight roster row (any tree, worktree rows included, < 2h old) blocks a new dispatch unless the prompt carries [allow-parallel: N lanes, ~Xk tokens each, <why>]; a bare [allow-parallel: reason] still blocks and the message names the missing cost.
- [2026-08-25 21:05] (comment) ticked: cold-worktree-build also fires when the brief NAMES a hand-made git worktree path (.git is a file) in a Cargo repo, not only on isolation:worktree.
- [2026-08-25 21:05] (comment) ticked: Tests: hooks/dispatch-guard.test.mjs covers block/escape/bare-escape/finished/stale/ignore/corrupt-roster/hand-made-worktree; the three KIT-T177 tree-scoped allowances now assert shared-tree stays silent while parallel-dispatch blocks.
- [2026-08-25 21:05] (comment) ticked: CLAUDE.global.md (kit source of the global contract) states the rule with the lived cost and the escape token.
- [2026-08-25 21:05] (comment) @claude: (fixed) hooks/dispatch-guard.mjs parallel-dispatch + hand-made-worktree cold-build detection; hooks/dispatch-guard.test. (full comment #1 in ## Notes)
### comment #1 [2026-08-25 21:05] @claude
(fixed) hooks/dispatch-guard.mjs parallel-dispatch + hand-made-worktree cold-build detection; hooks/dispatch-guard.test.mjs 97 passed / 0 failed; agent-roster.test.mjs green; live probe in stiletto-2349 with one agent in flight → BLOCKED (exit 2), with [allow-parallel: 2 lanes, ~400k tokens each, …] + worktree → allowed. user-config/CLAUDE.global.md line replaced. Trigger: Chris 2026-08-25 — four parallel lanes killed, 'NEVER AGAIN WITH ENFORCEMENT'.
- [2026-08-25 21:05] (status) doing → review
- [2026-08-25 21:10] (comment) @claude: Scoped (Chris 2026-08-25: 'this is primarily a Rust concern… a safe boundary, expand later if needed'): parallel-dispatc (full comment #2 in ## Notes)
### comment #2 [2026-08-25 21:10] @claude
Scoped (Chris 2026-08-25: 'this is primarily a Rust concern… a safe boundary, expand later if needed'): parallel-dispatch fires only where the repo root has a Cargo.toml; non-Rust repos are untouched. Test: allows in a non-Rust repo with a live agent. Suite 98/0.
