---
id: KIT-T233
title: Worktree agents share ONE git stash — cross-pop collision between parallel agents
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T082]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:36.197Z
updated: 2026-08-16T00:23:10Z
---

## Description
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

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] A PreToolUse(Bash|PowerShell) hook BLOCKS `git stash` (bare, push, pop, apply, drop) when the target checkout is a linked git worktree — detected by `--git-dir` != `--git-common-dir` or a path under `.claude/worktrees/`
- [x] The block message names the safe alternative (`git diff > file` + checkout, or a WIP commit) plus the check-id and both exclusion surfaces, per the kit's gate-message convention
- [x] Deliberate escapes exist: `[allow-stash: <reason>]` and `CLAUDE_KIT_ALLOW_STASH=1`; the gate fails open and no-ops on unadopted repos
- [x] Dispatch guidance states that worktree agents never `git stash` (agents/README.md, commands/work.md, commands/drain.md)
- [x] Tests cover block + non-block + escape paths

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
- Implemented as a sibling gate, `hooks/worktree-guard.mjs` — branch-guard stays single-responsibility
  (branch flips); the new file carries both worktree checks (`worktree-stash`, `worktree-cwd`).
- Adoption is resolved against the MAIN checkout (parent of `--git-common-dir`): a linked worktree's
  branch may not carry `.ai/`, which would otherwise make the gate no-op exactly where it is needed.
- Evidence: `hooks/worktree-guard.test.mjs` — 30 assertions, all passing; wired into
  `package.json` "test". Full `npm test` green except the pre-existing `server/server.test.mjs`
  (needs `express` from node_modules, absent in this worktree — unrelated).

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-16 00:10] (status) todo → doing
- [2026-08-16 00:23] (status) doing → review
- [2026-08-16 00:23] (comment) worktree-guard hook blocks git stash in a linked worktree; hooks/worktree-guard.test.mjs 30 passed
