---
id: KIT-T205
title: Agents ship conversation backstory into code comments — base contract needs a comment-content rule
type: bug
status: done
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T15:56:38Z
updated: 2026-08-06T16:12:11Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] SELF-COMMENTING CODE section of user-config/CLAUDE.global.md bans backstory comments: no quoted conversations/maintainer remarks, no development history, no ticket archaeology; doc comments say what the thing is and how to use it
- [x] Fix-on-sight rule codified: touching a file with backstory comments includes rewriting them
- [x] Exemplar cleaned: stiletto-2349 crates/stiletto-game3d/src/parts/lamp.rs stripped to contract comments, crate tests pass
- [x] Composed ~/.claude/CLAUDE.md rebuilt via bootstrap

## Plan
1.

## History
- [2026-08-06 15:56] (created) bug — Agents ship conversation backstory into code comments — base contract needs a comment-content rule
- [2026-08-06 15:57] (comment) criterion added: SELF-COMMENTING CODE section of user-config/CLAUDE.global.md bans backstory comments: no quoted conversations/maintainer remarks, no development history, no ticket archaeology; doc comments say what the thing is and how to use it
- [2026-08-06 15:57] (comment) criterion added: Fix-on-sight rule codified: touching a file with backstory comments includes rewriting them
- [2026-08-06 15:57] (comment) criterion added: Exemplar cleaned: stiletto-2349 crates/stiletto-game3d/src/parts/lamp.rs stripped to contract comments, crate tests pass
- [2026-08-06 15:57] (comment) criterion added: Composed ~/.claude/CLAUDE.md rebuilt via bootstrap
- [2026-08-06 15:57] (status) todo → doing
- [2026-08-06 16:12] (comment) ticked: SELF-COMMENTING CODE section of user-config/CLAUDE.global.md bans backstory comments: no quoted conversations/maintainer remarks, no development history, no ticket archaeology; doc comments say what the thing is and how to use it
- [2026-08-06 16:12] (comment) ticked: Exemplar cleaned: stiletto-2349 crates/stiletto-game3d/src/parts/lamp.rs stripped to contract comments, crate tests pass
- [2026-08-06 16:12] (comment) @claude: Base section rewritten; composed CLAUDE.md rebuilt via bootstrap.mjs; exemplar lamp.rs cleaned (stiletto ac1ad0d, cargo  (full comment #1 in ## Notes)
### comment #1 [2026-08-06 16:12] @claude
Base section rewritten; composed CLAUDE.md rebuilt via bootstrap.mjs; exemplar lamp.rs cleaned (stiletto ac1ad0d, cargo test -p stiletto-game3d lamp: 10 passed 0 failed); repo-wide sweep delegated as ST-T138 (worktree-isolated agent in flight); KIT-D059 recorded
- [2026-08-06 16:12] (status) doing → done
- [2026-08-06 16:12] (comment) ticked: Fix-on-sight rule codified: touching a file with backstory comments includes rewriting them
- [2026-08-06 16:12] (comment) ticked: Composed ~/.claude/CLAUDE.md rebuilt via bootstrap
