---
id: KIT-D079
title: Model routing is kit-only; projects hold no model choices
summary: the dispatch ladder and model-pinned lane agents live only in the kit; a project dispatch block is ignored and flagged as drift.
date: 2026-10-04
supersedes: every per-project ladder (a project `.ai/config.yml` `dispatch:` block); the project-level model-lane agents (opus48, opus5, opus55, sonnet55)
source: conversation 2026-10-04 (Chris directive, stiletto session; KIT-T326)
---

**Decision:** Model routing lives only in the claude-kit: the ladder (`dispatch.tiers`,
`default_tier` in the kit's `.ai/config.yml`) and the model-pinned lane agents (`agents/`,
installed for every project). `scripts/dispatch-ladder.mjs` resolves a tier from the kit
config only. A project `dispatch:` block is ignored and orient flags it as drift; the
project template carries none. Retired lanes (opus48, opus5) are deleted, current lanes
(sonnet55, opus55) ship from the kit.

**Why:** Chris, 2026-10-04: "This should NOT be at a project level. Models are a moving
target." A project fork of the ladder went stale (standard = claude-opus-4-8, no sonnet rung)
and routed straightforward work to opus 5.5. Rejected: merging a project block over the kit
ladder, which keeps a second home for the same fact. Recurring review of the ladder itself is
KIT-T339.
