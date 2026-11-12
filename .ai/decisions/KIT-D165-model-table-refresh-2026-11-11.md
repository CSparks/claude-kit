---
id: KIT-D165
title: Model table refresh 2026-11-11: newer models than the dispatch aliases
status: accepted
date: 2026-11-11
supersedes: KIT-D080
source: research/models-2026-11-11.md
summary: Fable alias moved to claude-fable-5-2 (grade A lineup 2026-11-11); all rows confirmed or re-dated; no family change
revised: 2026-11-12
---

**Decision:** (proposed) Move these aliases in .ai/config.yml dispatch.aliases and re-evaluate the job rows against the new cost and capability:

- fable: alias claude-fable-5-1 -> claude-fable-5-2

**Why:** scripts/model-refresh.mjs found a model newer than the alias for its family. The dispatch gate blocks until the aliases move. See research/models-2026-11-11.md. Accepting this sets status to accepted and updates the aliases and row evidence dates.
