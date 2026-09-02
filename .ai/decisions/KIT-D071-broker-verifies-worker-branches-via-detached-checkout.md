---
id: KIT-D071
title: Broker verifies worker branches via a detached checkout, and frees the branch on land
summary: build checkout detaches HEAD to the lane tip (never `git switch` a branch a worktree holds), rebases, ff-lands; on land the broker removes the worker's worktree then deletes the branch
date: 2026-09-02
supersedes:
source: KIT-T270
---

**Decision:** The build broker (scripts/broker/) verifies a worker's `lane/*` branch with
`git switch --detach <branch>` + `git rebase main` in the build checkout, NOT the brief's
literal `git switch <branch>`. On a green land it fast-forwards main to the rebased tip,
pushes, then — using the `worktree` path the job carries — `git worktree remove --force`s
the worker's worktree and deletes the branch. The broker's own control dirs
(queue/results/logs/lock) live under `<targetDir>/broker` (inside gitignored `target/`).

**Why:** A worker's lane branch is checked out in that worker's LIVE worktree, and git
refuses to `git switch` a branch already checked out elsewhere — the literal protocol
would fail on every job. `--detach` attaches HEAD to the commit, not the branch, so it
never collides; the rebased tip is a strict descendant of main, so the land is a real
fast-forward (linear history preserved). A branch held by a worktree also cannot be
deleted, so branch teardown must remove the worktree first — the broker owns this on land
(the job records the path) rather than racing the worker. Control dirs under `target/`
keep the broker's state from showing in `git status --porcelain`, which would otherwise
mark the checkout dirty and pause every job. Rejected: requiring workers to push branches
to a remote and having the broker fetch (adds a round trip and a remote dependency for
what is already one shared object store); requiring workers to tear down their worktree
before the land verify (leaves no worktree to re-fix in on a red land).
