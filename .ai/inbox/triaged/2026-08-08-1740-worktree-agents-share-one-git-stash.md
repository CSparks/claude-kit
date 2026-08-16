# Worktree agents share ONE git stash — cross-pop collision between parallel agents

2026-08-08, gridiron-blitz wave-1. refs/stash lives in the common git dir, so
every worktree sees one stash stack. Two parallel agents both used `git stash
push` for before/after baseline measurement; one's `pop` applied and dropped
the OTHER's entry (and separately a long-lived stash from main — GB-T093 WIP —
got popped into an agent worktree). Both recovered by SHA (orphaned stash
commits), but only because the agent noticed. Fixes: (a) dispatch briefs for
worktree agents must BAN git stash outright — baseline via `git diff > file` +
checkout, or a WIP commit on the worktree branch; (b) hook idea: block `git
stash` in worktree checkouts (cwd under .claude/worktrees/) the way
branch-guard blocks switches; (c) long-lived stashes on main are fragile
state — promote them to refs (a branch) instead.
