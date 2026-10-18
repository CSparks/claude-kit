---
id: KIT-D098
title: Planning is separate from coordination: opus plans (fable as backup), sonnet coordinates the main thread
summary: the main thread is sonnet; every plan is a dispatch to the plan job on opus with fable as its fallback; fable is no longer an orchestrator model
date: 2026-10-17
supersedes: KIT-D076
directive: true
enforced_by:
  - scripts/coordination-model.test.mjs
  - scripts/dispatch-ladder.test.mjs
  - hooks/dispatch-guard.test.mjs
source: Chris 2026-10-17; weekly reassessment e22f4af (research/models-capability-2026-10-17.md)
---

**Decision:**
- **The main thread coordinates on sonnet.** Orchestration, dispatch, relaying results and queue handling run on the table's `coordination` row (sonnet). It plans nothing.
- **A plan is a dispatch to the `plan` job,** which runs on **opus with fable as its fallback**. A dispatch to `plan` is itself the escalation (`self_escalating`), so it needs no `[escalate]`. Fable costs 2.5x opus (the 2026-10-17 reassessment), so it is the backup, not the default; it stays explicit-only elsewhere (`deep`), never asset authoring.
- **KIT-D076 is superseded where it says opus and fable are the orchestrator models.** Its other half stands: straightforward fixes dispatch on sonnet.
- **Made true, not recorded:** SessionStart orient flags a main thread on any other family and names the switch (`/model sonnet`); the dispatch guard's fable-inherit block now describes fable as the plan fallback; the base CLAUDE.md dispatch section states the rule.

**Chris, verbatim (2026-10-17):**
- "Planning is separate from coordination. Opus for planning, Sonnet for coordination."
- He picked "Opus, Fable as backup" for the plan row after the weekly reassessment flagged that fable costs 2.5x opus.

**Why:** a fable or opus main thread spent the most expensive tokens on coordination, which is relaying and dispatching; planning is where the larger model earns its cost, and it is a bounded dispatch with a written apply brief.

**Rejected:**
- Fable as the plan default: 2.5x the cost of opus for plans opus can write.
- Leaving it as a recorded preference: a main thread on the wrong family went unnoticed until orient named it.
