---
id: KIT-T479
title: pre-push silently skips the repo gate when git cannot set up the work tree: with the stiletto rapid-game submodule gitdir at core.bare=true
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T16:14:18Z
updated: 2026-10-14T16:17:53Z
---

## Description
pre-push silently skips the repo gate when git cannot set up the work tree: with the stiletto rapid-game submodule gitdir at core.bare=true (plus core.worktree), the kit .githooks/pre-push found no toplevel and pushed cdf70ab6..17688c7d to origin in 3 s without running <repo>/.githooks/pre-push (RG-T036 G4). A gate that cannot locate its repo hook must refuse the push (exit 1, naming the repair), not pass it. Fails-open here let an ungated push out.

kit-bug-shape: cap:bug:pre-push-silently-skips-the-repo-gate-when-git-c
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A repo whose HEAD tracks .githooks/pre-push refuses the push (exit 1, prints the repair) when git cannot set up the work tree (core.bare=true + core.worktree) or the hook is missing; a bare repo with no tracked hook still pushes (scripts/pre-push-chain.test.mjs cases 7-9; b8dfa30)

## Plan
1.

## History
- [2026-10-14 16:14] (created) bug — pre-push silently skips the repo gate when git cannot set up the work tree: with the stiletto rapid-game submodule gitdir at core.bare=true
- [2026-10-14 16:17] (comment) criterion added: A repo whose HEAD tracks .githooks/pre-push refuses the push (exit 1, prints the repair) when git cannot set up the work tree (core.bare=true + core.worktree) or the hook is missing; a bare repo with no tracked hook still pushes (scripts/pre-push-chain.test.mjs cases 7-9; b8dfa30)
- [2026-10-14 16:17] (comment) ticked: A repo whose HEAD tracks .githooks/pre-push refuses the push (exit 1, prints the repair) when git cannot set up the work tree (core.bare=true + core.worktree) or the hook is missing; a bare repo with no tracked hook still pushes (scripts/pre-push-chain.test.mjs cases 7-9; b8dfa30)
- [2026-10-14 16:17] (comment) @claude: Fixed b8dfa30: .githooks/pre-push fails closed. Evidence: node scripts/pre-push-chain.test.mjs = 19 passed; run against  (full comment #1 in ## Notes)
### comment #1 [2026-10-14 16:17] @claude
Fixed b8dfa30: .githooks/pre-push fails closed. Evidence: node scripts/pre-push-chain.test.mjs = 19 passed; run against the previous hook, 3 fail (bare+worktree not refused, no repair printed, missing tracked hook not refused). Negative controls: after git config core.bare false the same green hook runs and the push passes; a bare repo with no tracked hook exits 0. No push was made against rapid-game.
- [2026-10-14 16:17] (status) todo → review
