---
id: KIT-T339
title: Recurring model-to-duty review: periodically re-map models to jobs by cost and capability
type: feature
status: review
priority: critical
milestone:
labels: []
links: [KIT-T326, KIT-D080]
files: []
supersedes:
superseded_by:
created: 2026-10-06T01:45:05Z
updated: 2026-10-09T21:46:19Z
---

## Description
Chris 2026-10-01 (verbatim): "We need to have some kind of regular check in to map LLM models with duty based on cost and capability. It's a moving target."

Context: the firepower ladder (kit .ai/config.yml dispatch.tiers; KIT-D035/D042/D043/D076) is hand-edited dated judgment; the same day Chris flagged an opus dispatch as wasted tokens when sonnet 5.5 sufficed. Want a periodic nag/review (like the 15-day memory/maintenance reviews) that presents the current lineup, costs, observed outcomes per duty, and proposes ladder changes as a superseding decision. NOT built here: captured from the stiletto inbox (2026-10-01-1541), linked from KIT-T326. Ladder is kit-only (KIT-D079).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a recurring nag surfaces the lineup, per-duty cost and outcomes, and proposes a ladder change as a superseding decision
- [x] dispatch-ladder blocks a dispatch when the capability table is stale (evidence older than the refresh period, or a newer model than the table's newest alias is known) - test: stale table -> exit 2 naming the refresh
- [x] a scheduled refresh (routine/cron) researches the lineup + costs, writes research/models-<date>.md and a proposed superseding decision; running it clears the gate
- [x] orient prints table age and newest-known model each SessionStart; !! when stale

## Plan
1.

## History
- [2026-10-06 01:45] (created) feature — Recurring model-to-duty review: periodically re-map models to jobs by cost and capability
- [2026-10-09 21:07] (comment) @chris: Chris 2026-10-09 (dirt-empire session), after KIT-T403: 'Just like I want it enforced that capabilities per model are ro (full comment #1 in ## Notes)
### comment #1 [2026-10-09 21:07] @chris
Chris 2026-10-09 (dirt-empire session), after KIT-T403: 'Just like I want it enforced that capabilities per model are routinely researched based on newer model arrivals and that guides assignment.' then 'BOTH of these things have been asked for NUMEROUS times.' Asked 2026-10-01, filed 2026-10-06 at medium, never built - priority raised to critical; re-scoped from a nag to a GATE: (1) every dispatch.jobs row carries evidence_date + source (already in KIT-D080); (2) a scheduled refresh (routine/cron, weekly or on a newer-model signal from the Anthropic models endpoint / docs) researches the current lineup, cost per family and capability, writes a dated research doc and proposes the table change as a superseding decision; (3) the dispatch-ladder hook BLOCKS (exit 2) when the table's newest evidence_date is older than the refresh period or when a model newer than the table's newest alias is known to exist - the fix named is 'run the refresh'; (4) orient prints the table age and the newest-known model on every SessionStart as a !! line when stale; (5) assignment reads only the table (no routing in agents/, skills/, memory - the existing lint).
- [2026-10-09 21:07] (comment) criterion added: dispatch-ladder blocks a dispatch when the capability table is stale (evidence older than the refresh period, or a newer model than the table's newest alias is known) - test: stale table -> exit 2 naming the refresh
- [2026-10-09 21:07] (comment) criterion added: a scheduled refresh (routine/cron) researches the lineup + costs, writes research/models-<date>.md and a proposed superseding decision; running it clears the gate
- [2026-10-09 21:07] (comment) criterion added: orient prints table age and newest-known model each SessionStart; !! when stale
- [2026-10-09 21:28] (status) todo → doing
- [2026-10-09 21:46] (comment) @chris: 2026-10-09: built gates: dispatch-guard capability-table-stale (exit 2, names model-refresh), scripts/model-refresh.mjs  (full comment #2 in ## Notes)
### comment #2 [2026-10-09 21:46] @chris
2026-10-09: built gates: dispatch-guard capability-table-stale (exit 2, names model-refresh), scripts/model-refresh.mjs (lineup json + research note + proposed decision), orient models: line, housekeeping weekly nag, config dispatch.refresh_days. Tests: model-refresh 17, dispatch-guard 0 fail, full chain green (server/* needs express, not installed).
- [2026-10-09 21:46] (comment) ticked: a recurring nag surfaces the lineup, per-duty cost and outcomes, and proposes a ladder change as a superseding decision
- [2026-10-09 21:46] (comment) ticked: dispatch-ladder blocks a dispatch when the capability table is stale (evidence older than the refresh period, or a newer model than the table's newest alias is known) - test: stale table -> exit 2 naming the refresh
- [2026-10-09 21:46] (comment) ticked: a scheduled refresh (routine/cron) researches the lineup + costs, writes research/models-<date>.md and a proposed superseding decision; running it clears the gate
- [2026-10-09 21:46] (comment) ticked: orient prints table age and newest-known model each SessionStart; !! when stale
- [2026-10-09 21:46] (status) doing → review
