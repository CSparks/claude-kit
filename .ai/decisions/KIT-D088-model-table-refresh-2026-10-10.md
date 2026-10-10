---
id: KIT-D088
title: Model table refresh 2026-10-10: job-typed dispatch, weekly automatic reassessment, ui split, haiku for targeted changes
status: accepted
date: 2026-10-10
supersedes: KIT-D061 (the ui row), KIT-D080 (targeted-change row, refresh period)
source: research/models-2026-10-10.md; KIT-T419; Chris 2026-10-10 (dirt-empire session)
---

**Decision:**
- Every dispatch carries `[job: <dispatch.jobs id>]` (an agent definition may carry a default `job:`, never `model:`). The dispatch gate resolves the family from the table: no job blocks; an explicit model off the row's family blocks unless the prompt carries `[model-override: <reason>]`, which is logged on the roster row. A job with no model takes the row's family.
- The outcome ledger (`.ai/dispatch-outcomes.jsonl`, written on SubagentStop) and `scripts/dispatch-report.mjs` rank models per job by tokens per landing. Proposals (a cheaper family landed 3 clean on a dearer row; a dearer family used twice on a cheaper row) print in orient as `!! dispatch:`.
- Aliases move: fable -> claude-fable-5-1, haiku -> claude-haiku-5-5 (the lineup refresh found both).
- `dispatch.refresh_days` is 7. The gate blocks dispatch after 7 days without a refresh. The refresh reassesses CAPABILITY per job (a per-job table in `research/models-<date>.md`: row family, cost, ledger by model, proposal), not only lineup and cost.
- The weekly reassessment runs as an agent. When due (one day before the gate), housekeeping emits a DISPATCH NOW directive: a sonnet agent, `[job: research]`, runs `scripts/model-refresh.mjs`, researches each family's documented strengths, re-dates confirmed rows (`scripts/job-capability.mjs redate`), commits, and raises to Chris only an exception, one line each: a proposed family change on a row, a model or alias it cannot resolve. Its one-line receipt replaces the nag.
- `ui` splits. `ui-creative` (opus): visual and creative UI. `wiring` (sonnet): framework API wiring, crate adoption, submodule re-pins, instrumentation, settings and menu plumbing. `build` (spatial, geometry, generator, physics-contact) and `design` stay on opus.
- `targeted-change` gains haiku as the first rung when the brief's named files fit under about 100k tokens (the brief lists files and line ranges; the dispatcher sums their size). local-qwen is the free lane where available; sonnet above 100k tokens or after 2 failures on one ticket.
- Rows touched are re-dated 2026-10-10: chore, targeted-change, ui-creative, wiring.

**Why:** routing determines how fast the weekly usage limit is hit, so cost per landing by model is the metric the report ranks by. Chris 2026-10-10: "There needs to be a weekly reassessment based on research about what each model can do. This shit matters because it determines how quickly we hit our weekly limit." On automation: "and that process should run automatically with an agent unless the agent sees something that needs to be raised to my attention."

On the miss: "do we really need to be using opus for all that? ... straightforward enough that Sonnet can handle it" and "that's a failure of the assignment system ... not doing a good job tracking capabilities and assigning to the most appropriate agent model" (the same complaint 2026-10-01). Causes: a dispatch named a model but never its job, so the hooks could not check the model against the table; no outcome ledger fed the table; the ui row (opus, evidence 2026-08-06) made an rg-ui-engineer to opus dispatch look conformant.

On haiku: "Hell, even haiku now handles straightforward edits really efficiently. It just needs to be within a 100k context window."

Rejected: pinning models in agent definitions (KIT-D080); leaving ui whole (framework wiring is not creative work).
