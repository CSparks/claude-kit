---
id: KIT-T1414
title: Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T00:50:45Z
updated: 2026-11-19T00:50:45Z
---

## Description
Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds of problems and levels of depth that would be needed for assigning these models?' Want: (1) a dispatch-time difficulty rubric (systems/crates touched, root cause known vs to-find, numeric vs judgement proof, reference exists, coupling to other writers' files, expected context size) mapped to the owner's ladder KIT-D169 (Fable extremely difficult/deep, Opus very hard, Sonnet medium, Haiku automation); (2) record predicted tier + rubric scores with each dispatch and the outcome (retries, escalations, handoffs, tokens per landing, model that finished it) in the dispatch store; (3) a calibration report that compares predicted vs actual per job kind and proposes rubric/threshold changes, feeding the weekly reassessment; (4) a rule to SPLIT oversized multi-concern briefs (agents past ~600k tokens stalled repeatedly in the 2026-11-18 road-generator session) instead of upgrading the model. Reuse: dispatch-report.mjs, dispatch.jobs capability table, agents.jsonl.

kit-bug-shape: cap:feature:kit-a-difficulty-assessment-loop-for-model-routi:fc263976
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Design (2026-11-18, before build; decisions KIT-D169 ladder, KIT-D170 assessed difficulty, KIT-D171 haiku run-monitor):

Tag on every dispatch brief: `[difficulty: <tier>; systems=N root=known|area|unknown proof=numeric|mixed|judgement ref=yes|partial|no coupling=own|shared|global context=s|m|l]`, tier one of automation|medium|very-hard|extreme.

Rubric, each field 0/1/2, summed (0 to 12):
- systems: 1 crate or system = 0, 2 to 3 = 1, 4 or more, or cross-repo = 2
- root: cause known and named = 0, to find in a known area = 1, unknown or global = 2
- proof: a number or test proves it = 0, mixed = 1, judgement only (visual, design) = 2
- ref: a reference or spec exists = 0, partial = 1, none (novel) = 2
- coupling: own files only = 0, files shared with live writers = 1, global or cross-session = 2
- context: under 50k tokens = 0, 50k to 200k = 1, over 200k = 2
Tier from the sum: 0 to 1 automation (haiku; only for non-judgement work such as run-monitor and chore), 2 to 5 medium (sonnet), 6 to 8 very hard (opus), 9 to 12 extreme (fable). The family follows the tier (KIT-D169).
Split rule: systems=2 with context=2, or a brief listing two or more independent concerns, is refused with "split into one dispatch per concern" before any tier is assigned.

Gate (dispatch-guard, new check `dispatch-difficulty`) and `dispatch-ladder resolve --difficulty "<tag body>"`: the tag is required; a tag whose scores do not sum to its tier, or a model off the tier's family, is refused unless `[model-override: <reason>]`. With no tag the refusal names the rubric and the family the agent definition's default job would have given, as a fallback suggestion only; `[job: x]` stays required (what the work is), the difficulty decides the family.

Outcomes: the roster row (.ai/agents.jsonl) records the predicted tier and scores at dispatch; the outcome row appended to .ai/dispatch-outcomes.jsonl at SubagentStop gains predicted tier, scores, finishing model, tokens, and handoff (a Handoff block written); escalations and retries are counted per ticket from later dispatches citing the same ticket on a higher family or with the same brief. `node scripts/difficulty-calibration.mjs [--since <date>]` prints per predicted tier: dispatches, landings, escalation and retry rates, handoffs, tokens per landing, and the dispatches whose finishing family differs from the prediction.

Agent definitions: drop `job:` defaults and the `effort:` field from every agents/*.md (agent-pins' effort requirement turns into a rule that no agent carries model, effort or job); the brief carries job and difficulty.

## History
- [2026-11-19 00:50] (created) feature — Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds
