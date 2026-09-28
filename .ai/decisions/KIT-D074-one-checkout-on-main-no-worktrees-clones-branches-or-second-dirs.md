---
id: KIT-D074
title: One checkout, on main — no worktrees, clones, feature branches or second work directories
summary: Every agent works in the maintainer's one checkout, on main, one at a time, testing each step; hooks block every way to make a second branch or checkout. Fills in KIT-D039's empty body.
date: 2026-09-28
supersedes: KIT-D039 (restates it with a body and enforcement); the worktree guidance in KIT-T082, KIT-T176 and KIT-T226 text; KIT-D027 (worktrees optional)
source: conversation 2026-09-28 (Chris directive, Stiletto session); inbox 2026-09-28-1448
---

**Decision:** Every agent works in the maintainer's ONE checkout of a project, on `main`, one
implementation agent at a time, keeping the tree building by testing each step. No git
worktrees, clones, feature branches or second work directories, unless the maintainer
explicitly asks for one. Enforcement:

- `branch-guard` blocks `git switch`/`checkout` off main, `git switch -c`, `git checkout
  -b/-B/--orphan`, `git branch <new>`/`-m`/`-c`, `git worktree add`, and a `git clone` into a
  project, of a project, or of a project's remote beside it. Escape only
  `[maintainer-asked-branch: <his words>]`. The `[allow-branch:]` token and
  `CLAUDE_KIT_ALLOW_BRANCH` env are retired.
- `dispatch-guard` (`cold-worktree-build`) blocks every worktree dispatch in a Rust workspace,
  whatever the brief provisions (`CARGO_TARGET_DIR`, `[cold-build-ok]` no longer lift it).
  Escape only `[maintainer-asked-worktree: <his words>]`. No hook message suggests worktree
  isolation.
- The global contract (Delegation COST, ONE implementation agent, GIT WORKFLOW) says the same.

**Why:** Chris, 2026-09-28, emphatic and repeated: "Rust projects, unless otherwise directed,
should NEVER run parallel read/write agents and there shouldn't be any separate work
directories or branches." KIT-D039 (2026-07-14) already ruled this, but its body was never
filled in and the contract text and hooks still pointed agents at worktrees. An agent
followed that guidance, moved half-done work into `D:/dev/stiletto-d2`, force-deleted it and
nearly lost it.

Rejected: worktrees with a shared `CARGO_TARGET_DIR` (still a second copy that strands work);
self-granted escape tokens (`[allow-branch:]`, `[cold-build-ok:]`) — only the maintainer's
quoted words lift the block.
