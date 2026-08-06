---
id: KIT-T203
title: agents/hook-author.md — the hook-authoring specialist the kit keeps hand-writing briefs for
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:33Z
updated: 2026-08-06T02:29:33Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> # hook-author specialist agent missing from the kit
>
> Dispatching KIT-T182 (context7 ledger hook, 2026-08-05) required a long
> hand-written brief to general-purpose — per the contract, that IS a specialist
> never written down. Hook authoring recurs constantly (hooks/ has a dozen+
> portable Node hooks) and has stable conventions worth encoding once:
> payload-read-robustly + fail-open, opt-in-aware vs machine-global scoping,
> never bash, test conventions (scripts/*.test.mjs / test-hooks.mjs), wiring +
> plugin version bump, exclusion-surface footers (check-id + both surfaces).
>
> Fix: agents/hook-author.md in the kit — model pinned opus, tools scoped,
> conventions + gotchas above written in. (KIT-D049 specialists-over-general.)

Provenance: `.ai/inbox/triaged/2026-08-05-1931-hook-author-specialist-agent-missing.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] agents/hook-author.md exists with a pinned model and scoped tools
- [ ] it carries the hook conventions: payload read robustly, fail-open, opt-in-aware scoping, never bash, test + wiring + version-bump steps, exclusion-surface footers
- [ ] the dispatch-guard pin sweep covers it (KIT-T191)

## Plan
1.

## History
- [2026-08-06 02:29] (created) feature — agents/hook-author.md — the hook-authoring specialist the kit keeps hand-writing briefs for
- [2026-08-06 02:31] (comment) criterion added: agents/hook-author.md exists with a pinned model and scoped tools
- [2026-08-06 02:31] (comment) criterion added: it carries the hook conventions: payload read robustly, fail-open, opt-in-aware scoping, never bash, test + wiring + version-bump steps, exclusion-surface footers
- [2026-08-06 02:31] (comment) criterion added: the dispatch-guard pin sweep covers it (KIT-T191)
