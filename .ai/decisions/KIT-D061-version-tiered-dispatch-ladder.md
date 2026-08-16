---
id: KIT-D061
title: The dispatch ladder is version-tiered — full-id pins, nine named intents, effort re-derived on fallback
summary: The dispatch ladder pins FULL model ids across nine named tiers, and effort is re-derived per model on any fallback.
date: 2026-08-06
supersedes: KIT-T191 tiering (game-asset-artist returns to fable for the asset lane); KIT-D060's deep-fallback-at-medium note (effort is re-derived per target model instead)
source: AskUserQuestion 2026-08-06 (Chris — 4 answers); research/model-routing-ladder-2026-08.md (KIT-T208)
---

**Decision:** `dispatch.tiers` becomes a nine-tier, version-pinned ladder (kit config, propagated
to adopted repos):

| tier | model | effort | intent |
|---|---|---|---|
| light | claude-haiku-4-5 | (inert) | search, triage, mechanical edits |
| standard | claude-opus-5 | low | ALL everyday coding (KIT-D060) |
| careful | claude-opus-5 | medium | tricky/cross-file implementation |
| scoped | claude-opus-4-8 | high | instruction-tight small tasks; the rollback when Opus 5 over-scopes |
| ui | claude-opus-4-8 | high | UI/frontend creative |
| asset | claude-fable-5 → opus-5@high | medium | 3D modeling / game-asset authoring |
| forensic | claude-fable-5 → opus-5@xhigh | medium (2nd pass: high) | regressions (default_tier) |
| deep | claude-fable-5 → opus-5@high | high | architecture, planning, epics |
| max | claude-fable-5 | max | explicit-only frontier problems |

Rules that ride with the table: (1) **Full model ids only** — aliases are not pins (`opus`
silently retargeted 4.8 → Opus 5 at Claude Code v2.1.219); every kit agent's frontmatter pins a
full id, enforced by dispatch-guard's test sweep, with fable-class pins legal only for the asset
lane (game-asset-artist, light-and-shadow). (2) **Effort is not portable across models** — a
fallback re-derives effort per the tier comment, never carries it (4.8 degrades below high;
Opus 5 is strong at low/medium). (3) The Agent tool's `model` param is alias-only and OVERRIDES
frontmatter, so versioned tiers dispatch via pinned agents and the orchestrator omits the param
there (KIT-T209 scaffolds the scoped/ui pinned agents). (4) Opus 4.6 and 4.7 carry no tier:
4.6 has no community support for the "straightforward fixes" role, respects low/medium effort
less strictly, and lacks xhigh; 4.7 is strictly dominated by 4.8 at the same price.

**Why:** Chris asked for a properly fleshed-out ladder leveraging older versions and reserving
high thinking for architecture/planning/persistent bugs. The evidence
(research/model-routing-ladder-2026-08.md, A-tier-first) reshaped the specifics: the whole Opus
line costs the same, so older Opus is a behavior play — and the version the community actually
uses for instruction-tight scoped work is 4.8, not 4.6. Anthropic's own effort docs back
low/medium as the primary lever on 5-generation models and warn that max overthinks. The
creative split (ui vs asset) and the forensic regression staging are Chris's calls from the
questionnaire, verbatim: "Opus 4.8 high for UI and Fable 5 medium based on availability, falling
back to opus 5 high"; regressions "fable/medium first pass, fable high second pass, if not
available, Opus 5 xhigh."

Rejected: a 4.6 mechanic tier (no evidence, worst effort compliance in the lineup, earliest
retirement); sonnet anywhere on the ladder (KIT-D043 reaffirmed — measured 3.7x real-workload
cost from tokenizer inflation); alias pins (the drift bug this decision fixes).

## Notes
- [2026-08-16 00:06] (comment) folded from triage: feedback Tier misfire (Chris, 2026-08-06, hot): a floodlight day/night COUPLING - pure wiring to an existing ramp - was dispatched on the ASSET lane (fable/medium) because it touched lighting files; ran 24+ min and was killed mid-overscope (it was re-verifying the headlight refactor, not asked). Rule: the lane is chosen by TASK CLASS, never by file domain - asset lane = authoring meshes/materials/visual design; wiring/coupling/config near assets = standard (opus/low). Also exposed: no live progress visibility on in-flight agents from the roster (couldn't answer 'what is it doing'), and no runtime alarm when a small-brief dispatch exceeds ~15 min. Fold into KIT-D061 guidance + ticket the progress/alarm gaps.
