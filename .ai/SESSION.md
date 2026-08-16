# SESSION HANDOFF — claude-kit

Updated: 2026-08-15 ~19:30 | Branch: main (041add4) | Active: drain wave 1 (7 opus worktree agents in flight)

## Current state
- Triage applied cross-project: 62 caps promoted (281c5e8) — KIT-T214..T238, KIT-D065/D066, folds into KIT-T196/T168/T179/T211/D061.
- KIT-D064 committed (041add4), pushed.
- KIT-T208#1 mention acked.
- Wave 1 dispatched (each `isolation: worktree`, model opus, standard tier). Merge each worktree branch back to main when it reports; run `npm test` after merging all.
  1. KIT-T228 roster ordering (hooks/agent-roster.mjs)
  2. KIT-T233 + T115 worktree hazards (branch-guard: block git stash in worktree; warn cwd in .claude/worktrees)
  3. KIT-T221 + T223 + T235 agent pins / registration / installed-copy drift
  4. KIT-T111 + T155 + T231 magic-numbers false positives (pre-write.mjs)
  5. KIT-T167 + T236 + T238 query tooling (q inbox verb, source-discovery exempts .ai, code-graph stale-index robustness)
  6. KIT-T106 + T230 + T170 commit hygiene + decisions id canon
  7. KIT-T141 + T157 + T162 + T117 store CLIs (t new priority, end-task --root/fixed_commit, next-id prefix + cross-store claims)

## Constraint (Chris, 2026-08-15): drain KIT tickets ONLY — do not dispatch on other projects' stores.

## Next 3 steps
1. Collect agent reports → merge branches into main (resolve conflicts, esp. hooks/lib.mjs, package.json test line) → `npm test` → push.
2. Wave 2 candidates: KIT-T219 (pre-edit tree-liveness guard), KIT-T232 (drain governing-decision check in begin-task), KIT-T160 (API writes auto-commit), KIT-T171 (Stop-gate build check), process-failure doctrine tickets (T105/T113/T159/T163/T214/T217/T218/T222/T226/T229/T234/T237) → likely one contract/hook batch + a /decide.
3. Roadmap head KIT-T048 (provenance enforcement) — design-heavy; maintainer's call.
