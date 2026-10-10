---
id: KIT-T336
title: Capability-tier model routing for kit agents: replace every hard-coded model id in agents/*.md (and commands/skills that name one) with a ti
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T00:43:28Z
updated: 2026-10-06T00:43:28Z
---

## Description
Capability-tier model routing for kit agents: replace every hard-coded model id in agents/*.md (and commands/skills that name one) with a tier (e.g. orchestrator / builder / analyst / mechanical) resolved at dispatch from one ladder file in the kit (dispatch.tiers source of truth); the dispatch-ladder hook resolves tier->current id and blocks a raw id; a kit test lints agents/ for raw ids and for ids not in the ladder; update the ladder so no entry resolves to claude-opus-5 while claude-opus-5-5 exists; put game-asset-artist on the builder (opus 5.5) tier, not fable. Supersedes KIT-T335's audit.

kit-bug-shape: cap:feature:capability-tier-model-routing-for-kit-agents-rep
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 00:43] (created) feature — Capability-tier model routing for kit agents: replace every hard-coded model id in agents/*.md (and commands/skills that name one) with a ti
- [2026-10-06 03:03] (comment) @claude: 2026-10-06: dispatching claude-kit:audio-synthesist with the Agent tool's model override 'opus' produced a task labelled (full comment #1 in ## Notes)
### comment #1 [2026-10-06 03:03] @claude
2026-10-06: dispatching claude-kit:audio-synthesist with the Agent tool's model override 'opus' produced a task labelled '[Opus 5] …' by the harness — the alias may resolve to claude-opus-5, not 5.5. The ladder must emit FULL ids and the dispatch receipt must print the id actually sent to the API (the earlier failure notice did: 'model sent to the API: claude-fable-5').
