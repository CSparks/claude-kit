---
id: KIT-T1414
title: Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T00:50:45Z
updated: 2026-11-19T01:47:42Z
fixed_commit: 9d9fa2b4
---

## Description
Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds of problems and levels of depth that would be needed for assigning these models?' Want: (1) a dispatch-time difficulty rubric (systems/crates touched, root cause known vs to-find, numeric vs judgement proof, reference exists, coupling to other writers' files, expected context size) mapped to the owner's ladder KIT-D169 (Fable extremely difficult/deep, Opus very hard, Sonnet medium, Haiku automation); (2) record predicted tier + rubric scores with each dispatch and the outcome (retries, escalations, handoffs, tokens per landing, model that finished it) in the dispatch store; (3) a calibration report that compares predicted vs actual per job kind and proposes rubric/threshold changes, feeding the weekly reassessment; (4) a rule to SPLIT oversized multi-concern briefs (agents past ~600k tokens stalled repeatedly in the 2026-11-18 road-generator session) instead of upgrading the model. Reuse: dispatch-report.mjs, dispatch.jobs capability table, agents.jsonl.

kit-bug-shape: cap:feature:kit-a-difficulty-assessment-loop-for-model-routi:fc263976
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] every dispatch carries a [difficulty:] assessment whose tier decides the family; the dispatch-difficulty guard refuses a missing, inconsistent or off-family assessment with the rubric and a ready-to-paste tag, only in sessions begun after it took effect (scripts/difficulty.test.mjs)
- [x] the rubric (systems, root, proof, ref, coupling, context, 0-2 each; 0-1 haiku, 2-5 sonnet, 6-8 opus, 9-12 fable) and the split rule
- [x] prediction and outcome recorded per dispatch and a calibration report that names re-date candidates for the weekly reassessment
- [x] no agent definition carries a model, effort or job (agent-pins, plugin-compat)

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
Built per the accepted design (2026-11-18):

1. Gate and resolver: hooks/lib/difficulty.mjs (the rubric, tiers, ladder, split rule, example tag) and hooks/dispatch-difficulty.mjs (check `dispatch-difficulty` in dispatch-guard). A brief with no `[difficulty: …]` tag, a tag whose scores do not sum to its tier, a brief that must be split, or a model off the tier's family (without `[model-override: <reason>]`) is refused, and the refusal prints the rubric, the family the agent definition's default job would have given (a fallback suggestion only) and a ready-to-paste tag. Enforced only in a session whose transcript starts after ENFORCED_SINCE (2026-11-19T01:30Z) and is readable; an older session or a payload with no transcript gets the same text as a warning. dispatch-job and dispatch-escalation accept a model that a well-formed assessment gives. `dispatch-ladder resolve --job <job> --difficulty "<tag body>"` returns the assessed family (and the job row's effort only when the families agree, else the family's default effort). `q gates agent` lists the check and the tag form; the dispatch checklists in user-config/CLAUDE.global.md and commands/work.md, drain.md name the tag.
2. Rubric: systems, root, proof, ref, coupling, context, each 0-2; sum 0-1 haiku, 2-5 sonnet, 6-8 opus, 9-12 fable; split when systems and context both score 2, or a `Concerns:` list holds two or more items.
3. Outcomes: the roster row records `difficulty { tier, sum, family }`; the outcome row in .ai/dispatch-outcomes.jsonl carries `predicted` and `tickets` beside the finishing `model` and tokens. scripts/difficulty-calibration.mjs reports per predicted tier: dispatched, landed, share finished by another family, retried and escalated (later dispatches on the same ticket), handoffs (Handoff blocks naming the agent), tokens per landing; and for the weekly reassessment the re-date candidates (3 or more landings on the row's own family) and the rows mostly assessed onto another family. model-refresh prints that report after each refresh, so the two feed each other.
4. Agent definitions: every agents/*.md lost its `job:` and `effort:` lines and any model wording (analyst, analyst-max, implementer, patch-worker); agent-pins and plugin-compat now fail a model, effort or job line. Plugin 0.1.61.

Tests: scripts/difficulty.test.mjs 6 pass (rubric and tiers, split, resolve, the guard enforced vs warned with the example tag and model checks, an opus dispatch on a sonnet job row through the real gate, outcome row and calibration with re-date and review rows); agent-pins all ok; plugin-compat 163; gate-protocol 56; dispatch-label (the kit-agent default-job case now names the job in the brief), dispatch-job, dispatch-escalation, dispatch-guard, dispatch-guard-stale, dispatch-worker, dispatch-brief, dispatch-tests, dispatch-ui, dispatch-shared-tree pass; model-tag 65; agent-roster 48; handback 51; contract-rules 48; plugin-drift 14; search-adoption 9.

## History
- [2026-11-19 00:50] (created) feature — Kit: a difficulty-assessment loop for model routing. Owner (2026-11-18): 'Do you think you can build the capacity to better assess the kinds
- [2026-11-19 00:59] (landed) b1a6eb7a decisions KIT-D170 (a dispatch's model follows the assessed difficulty of its job, not the agent definition) and KIT-D17
- [2026-11-19 01:45] (status) todo → doing
- [2026-11-19 01:45] (comment) criterion added: every dispatch carries a [difficulty:] assessment whose tier decides the family; the dispatch-difficulty guard refuses a missing, inconsistent or off-family assessment with the rubric and a ready-to-paste tag, only in sessions begun after it took effect (scripts/difficulty.test.mjs)
- [2026-11-19 01:45] (comment) criterion added: the rubric (systems, root, proof, ref, coupling, context, 0-2 each; 0-1 haiku, 2-5 sonnet, 6-8 opus, 9-12 fable) and the split rule
- [2026-11-19 01:45] (comment) criterion added: prediction and outcome recorded per dispatch and a calibration report that names re-date candidates for the weekly reassessment
- [2026-11-19 01:45] (comment) criterion added: no agent definition carries a model, effort or job (agent-pins, plugin-compat)
- [2026-11-19 01:45] (comment) ticked: every dispatch carries a [difficulty:] assessment whose tier decides the family; the dispatch-difficulty guard refuses a missing, inconsistent or off-family assessment with the rubric and a ready-to-paste tag, only in sessions begun after it took effect (scripts/difficulty.test.mjs)
- [2026-11-19 01:45] (comment) ticked: the rubric (systems, root, proof, ref, coupling, context, 0-2 each; 0-1 haiku, 2-5 sonnet, 6-8 opus, 9-12 fable) and the split rule
- [2026-11-19 01:45] (comment) ticked: prediction and outcome recorded per dispatch and a calibration report that names re-date candidates for the weekly reassessment
- [2026-11-19 01:45] (comment) ticked: no agent definition carries a model, effort or job (agent-pins, plugin-compat)
- [2026-11-19 01:47] (landed) 9d9fa2b4 dispatch difficulty: every brief carries a [difficulty:] assessment whose tier decides the family (KIT-D170); dispatch-d
- [2026-11-19 01:47] (status) doing → review
- [2026-11-19 01:47] (comment) runtime 9d9fa2b4 published, plugin 0.1.61
