---
id: KIT-T419
title: Assignment system fails to track capabilities and route to the right model (Chris 2026-10-10, dirt-empire: 'do we really need to be using opus for all that? … straightforward enough that Sonnet can handle it' / 'that's a failure of the assignment system … not doing a good job tracking capabilities and assigning to the most appropriate agent model'; same complaint 2026-10-01). Root causes: (1) a dispatch names a MODEL but never its JOB TYPE, so dispatch-guard/dispatch-ladder cannot check the model against dispatch.jobs — routing stays free-hand per dispatch and drifts to opus; (2) no outcome ledger feeds the table — nothing records that sonnet landed job X, so evidence never updates; (3) stale rows: ui = opus on 2026-08-06 evidence (KIT-D061) made an rg-ui-engineer → opus dispatch look table-conformant; model refresh never run (nag firing). Fix: (A) every dispatch carries [job: <dispatch.jobs id>] (agent frontmatter may carry a default job:, no model:); the hook RESOLVES the family from the table and BLOCKS a labelled model that differs unless [model-override: <reason>] — a missing job blocks; (B) SubagentStop appends {job, model, tokens, tool_uses, outcome} to .ai/dispatch-outcomes.jsonl; scripts/dispatch-report.mjs per job type: tokens/landings by model, proposes table edits ('sonnet landed N ui jobs → downgrade'); orient prints the proposals; (C) run model-refresh now and re-date rows; split ui into ui-creative (opus) and framework-wiring/adoption/re-pin/instrumentation (sonnet) with Chris's 2026-10-10 words as source, as a superseding decision over KIT-D061/KIT-D080 --link KIT-T339 --link KIT-T403 --link KIT-D080
type: bug
status: doing
priority: critical
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T16:12:01Z
updated: 2026-10-10T16:15:47Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 16:12] (created) bug — Assignment system fails to track capabilities and route to the right model (Chris 2026-10-10, dirt-empire: 'do we really need to be using opus for all that? … straightforward enough that Sonnet can handle it' / 'that's a failure of the assignment system … not doing a good job tracking capabilities and assigning to the most appropriate agent model'; same complaint 2026-10-01). Root causes: (1) a dispatch names a MODEL but never its JOB TYPE, so dispatch-guard/dispatch-ladder cannot check the model against dispatch.jobs — routing stays free-hand per dispatch and drifts to opus; (2) no outcome ledger feeds the table — nothing records that sonnet landed job X, so evidence never updates; (3) stale rows: ui = opus on 2026-08-06 evidence (KIT-D061) made an rg-ui-engineer → opus dispatch look table-conformant; model refresh never run (nag firing). Fix: (A) every dispatch carries [job: <dispatch.jobs id>] (agent frontmatter may carry a default job:, no model:); the hook RESOLVES the family from the table and BLOCKS a labelled model that differs unless [model-override: <reason>] — a missing job blocks; (B) SubagentStop appends {job, model, tokens, tool_uses, outcome} to .ai/dispatch-outcomes.jsonl; scripts/dispatch-report.mjs per job type: tokens/landings by model, proposes table edits ('sonnet landed N ui jobs → downgrade'); orient prints the proposals; (C) run model-refresh now and re-date rows; split ui into ui-creative (opus) and framework-wiring/adoption/re-pin/instrumentation (sonnet) with Chris's 2026-10-10 words as source, as a superseding decision over KIT-D061/KIT-D080 --link KIT-T339 --link KIT-T403 --link KIT-D080
- [2026-10-10 16:12] (comment) @claude: Chris 2026-10-10 (verbatim): 'Hell, even haiku now handles straightforward edits really efficiently. It just needs to be (full comment #1 in ## Notes)
### comment #1 [2026-10-10 16:12] @claude
Chris 2026-10-10 (verbatim): 'Hell, even haiku now handles straightforward edits really efficiently. It just needs to be within a 100k context window.' Table row: targeted-change / straightforward edits -> haiku when the brief + files fit under ~100k tokens (the brief states file list + line ranges; the dispatch estimates context from the named files), sonnet above that; local-qwen stays the free rung where available. Evidence date 2026-10-10, source these words.
- [2026-10-10 16:12] (comment) @claude: Chris 2026-10-10 (verbatim): 'There needs to be a weekly reassessment based on research about what each model can do. Th (full comment #2 in ## Notes)
### comment #2 [2026-10-10 16:12] @claude
Chris 2026-10-10 (verbatim): 'There needs to be a weekly reassessment based on research about what each model can do. This shit matters because it determines how quickly we hit our weekly limit.' -> refresh_days 7 (gate), model-refresh reassesses capability per job row from research + the outcome ledger, report ranks by cost per landing; relayed to the writer.
- [2026-10-10 16:15] (comment) @claude: Chris 2026-10-10 (verbatim): 'and that process should run automatically with an agent unless the agent sees something th (full comment #3 in ## Notes)
### comment #3 [2026-10-10 16:15] @claude
Chris 2026-10-10 (verbatim): 'and that process should run automatically with an agent unless the agent sees something that needs to be raised to my attention.' -> the weekly run is an AGENT dispatched automatically when due (housekeeping/orient auto-dispatch or a scheduled trigger), not a nag for Chris: it runs the script, applies what is safe (table re-dates, docs moves proposed as a ticket, trims within the ceiling), and raises ONLY exceptions (a proposed model downgrade/upgrade, an injection that cannot be trimmed under 25k) as one AskUserQuestion-ready item
- [2026-10-10 16:15] (status) todo → doing
- [2026-10-10 16:25] (comment) @claude: A landed: hooks/dispatch-job.mjs (job-typed dispatch gate), agent default job:, roster records job+modelOverride
