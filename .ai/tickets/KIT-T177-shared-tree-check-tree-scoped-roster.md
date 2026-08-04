---
id: KIT-T177
title: shared-tree-dispatch filters by actual tree — roster rows record isolation + repo root + completion
type: bug
status: review
priority: high
milestone:
labels: [hooks, dispatch, roster]
links: [KIT-T176]
files: [hooks/agent-roster.mjs, hooks/dispatch-guard.mjs]
supersedes:
superseded_by:
created: 2026-08-04T21:20:00Z
updated: 2026-08-04T18:39:11Z
fixed_commit: 755f08b
---

## Description

KIT-T176's `shared-tree-dispatch` check fired its first live block on a genuinely EMPTY
tree (stiletto, 2026-08-04 20:55 — inbox capture of the same date, now triaged here).
It counted: (1) a completed agent whose roster row was never marked terminal, (2) an
agent running in its OWN worktree, (3) an agent dispatched into a DIFFERENT repo. Root
cause (per the T176 implementer): `agent-roster.mjs` keys rows on the dispatching
session's `gitRoot()` and records neither isolation nor target repo, so the roster is
session-scoped while the check needs tree-scoped.

## Acceptance Criteria
- [x] `agent-roster.mjs` records `isolation` and the resolved target repo root on each row at PostToolUse time
- [x] Completion marking verified: SubagentStop reliably flags the row terminal; investigate why the researcher row stayed in-flight after collection, fix the gap
- [x] `dispatch-guard` `shared-tree-dispatch` filters to rows that are: not terminal, not worktree-isolated, same repo root as the new dispatch — the three false-positive classes each get a regression test
- [x] Old-format rows (no isolation/root fields) are treated conservatively BUT stale-aged as today — no crash, fail-open on unparseable rows
- [x] Kit suite green; README updated if the check's semantics description changes

## Notes

**What the completion bug actually was.** Not a missing SubagentStop — an ORDERING
inversion. `PostToolUse(Task)` fires when the tool RESULT lands, so a synchronous
delegation's dispatch row is appended 2-3s AFTER its own `SubagentStop` row. `readAgents`
collapses latest-row-wins, so the late `in-flight` dispatch row overwrote the `done` row
and the agent stayed in-flight forever. Evidence: 8 such inverted pairs in stiletto's
`.ai/agents.jsonl` (2026-08-03/04), each `done` at T and `in-flight` at T+2-3s for the
same id. Fixed at the WRITER (`dispatchStatus`) — it records the status the roster already
knows rather than asserting in-flight over a terminal row; the terminal set stays lib's
(`partitionAgents`), never a second copy. Fixing it in `readAgents` would have been the
other home, but `hooks/lib.mjs` is 961 lines and the file-length gate hard-blocks every
edit to it (KIT-T112) — a gate-forced restructure, deliberately not undertaken here.

**Residual imprecision (documented in the guard, not papered over).**
1. A dispatch that emits NO terminal event at all (the harness does not guarantee
   SubagentStop for every dispatch shape — stiletto's roster has 4 such rows) still counts
   until the 2h stale window ages it out. Escapable per dispatch with `[shared-tree-ok:]`.
2. Legacy inverted pairs already on disk stay in-flight until they age out (≤2h); no new
   ones are written after this fix.
3. Target-repo resolution is heuristic where it must be: a brief's target tree is only
   machine-readable from its text. Only a path that IS a repo root (`.git` present) counts,
   and anything unresolvable falls back to the session's own tree — the side that blocks.
4. Cross-repo blind spot: the row is written to the DISPATCHING repo's roster (KIT-D015
   durability needs it there), so a session in repo B cannot see an agent that session A
   sent into B. Out of scope here.

Test artifact: `hooks/dispatch-guard.test.mjs` 50 cases (was 41) — one per false-positive
class plus negative controls (an identical row WITHOUT the new fields still blocks);
`hooks/agent-roster.test.mjs` 40 cases (was 34) including the out-of-order regression.
Full kit suite green (`npm test` exit 0).
### comment #1 [2026-08-04 18:39] @claude
(fixed) 755f08b - tree-scoped roster: rows stamp isolation + targetRoot; the completion bug was a PostToolUse-after-SubagentStop ordering inversion, fixed at the writer. dispatch-guard 50 cases, agent-roster 40 cases, full suite green.

## History
- [2026-08-04 21:20] (created) first live firing produced 3-class false positive; promoted from inbox 2026-08-04-2055
- [2026-08-04 21:20] (status) todo → doing — dispatching
- [2026-08-04 18:38] (comment) ticked: `agent-roster.mjs` records `isolation` and the resolved target repo root on each row at PostToolUse time
- [2026-08-04 18:38] (comment) ticked: `dispatch-guard` `shared-tree-dispatch` filters to rows that are: not terminal, not worktree-isolated, same repo root as the new dispatch — the three false-positive classes each get a regression test
- [2026-08-04 18:38] (comment) ticked: Kit suite green; README updated if the check's semantics description changes
- [2026-08-04 18:38] (comment) ticked: Completion marking verified: SubagentStop reliably flags the row terminal; investigate why the researcher row stayed in-flight after collection, fix the gap
- [2026-08-04 18:38] (comment) ticked: Old-format rows (no isolation/root fields) are treated conservatively BUT stale-aged as today — no crash, fail-open on unparseable rows
- [2026-08-04 18:39] (comment) @claude: (fixed) 755f08b - tree-scoped roster: rows stamp isolation + targetRoot; the completion bug was a PostToolUse-after-Suba (full comment #1 in ## Notes)
- [2026-08-04 18:39] (status) doing → review
