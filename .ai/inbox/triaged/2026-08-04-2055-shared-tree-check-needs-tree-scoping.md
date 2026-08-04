# shared-tree-dispatch counts agents that are not in the tree — needs scoping

First firing of KIT-T176's `shared-tree-dispatch` check (stiletto, 2026-08-04 20:55)
blocked a dispatch into a genuinely EMPTY main tree. Its roster read counted three
rows as "in flight in this working tree":
1. a completed agent (researcher — result collected 90+ min prior; row apparently
   never marked complete, or completion isn't checked),
2. a live agent running in its OWN WORKTREE (`isolation: worktree` — by definition
   not this tree; the check exists to PUSH work toward worktrees, so counting
   worktree rows against the shared tree is self-defeating),
3. a live agent dispatched into a DIFFERENT REPO (claude-kit) — the roster is
   session-scoped, not tree-scoped.

## Refinements needed (keep the halt, fix the read)
- Skip rows whose completion is recorded (verify SubagentStop marking actually lands;
  if rows lag, cross-check against task state where possible).
- Skip rows dispatched with `isolation: worktree` — record isolation in the roster row
  at PostToolUse time so the check can see it.
- Scope rows to the repo the dispatch targets — record repo root per row; a
  kit-repo agent must not block a stiletto dispatch.
- Until fixed, false positives route through `[shared-tree-ok: <reason>]` — correct
  per the hook contract (escape, don't weaken), but each one costs a turn.
Resolution this time: re-dispatched with the token; main tree verified empty by
task-status + process checks first.
