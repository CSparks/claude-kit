---
id: KIT-T177
title: shared-tree-dispatch filters by actual tree — roster rows record isolation + repo root + completion
type: bug
status: doing
priority: high
milestone:
labels: [hooks, dispatch, roster]
links: [KIT-T176]
files: [hooks/agent-roster.mjs, hooks/dispatch-guard.mjs]
supersedes:
superseded_by:
created: 2026-08-04T21:20:00Z
updated: 2026-08-04T21:20:00Z
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
- [ ] `agent-roster.mjs` records `isolation` and the resolved target repo root on each row at PostToolUse time
- [ ] Completion marking verified: SubagentStop reliably flags the row terminal; investigate why the researcher row stayed in-flight after collection, fix the gap
- [ ] `dispatch-guard` `shared-tree-dispatch` filters to rows that are: not terminal, not worktree-isolated, same repo root as the new dispatch — the three false-positive classes each get a regression test
- [ ] Old-format rows (no isolation/root fields) are treated conservatively BUT stale-aged as today — no crash, fail-open on unparseable rows
- [ ] Kit suite green; README updated if the check's semantics description changes

## History
- [2026-08-04 21:20] (created) first live firing produced 3-class false positive; promoted from inbox 2026-08-04-2055
- [2026-08-04 21:20] (status) todo → doing — dispatching
