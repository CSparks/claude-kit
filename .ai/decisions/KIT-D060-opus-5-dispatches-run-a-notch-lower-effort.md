---
id: KIT-D060
title: Opus 5 dispatches run an effort notch lower across the ladder
date: 2026-08-06
supersedes: KIT-D035 (effort values for opus tiers only)
source: conversation 2026-08-06 (Chris, verbatim)
---

**Decision:** Every agent spun up on Opus 5 runs at lower effort than the ladder previously
gave it. Chris, verbatim 2026-08-06: "all agents spun up with Opus 5 need to be on lower
effort." Applied: `dispatch.tiers.standard` = opus/**low** (was medium); the `deep` tier's
opus FALLBACK dispatches at **medium** (was high — fable itself stays high); all seven
opus-pinned kit agents (`agents/*.md`) pin `effort: low` in frontmatter so an ad-hoc Agent
call can't silently inherit a high-effort main thread. Explicit per-ticket `effort:` overrides
stay legal, as ever (KIT-D035 resolution order unchanged).

**Why:** Model judgments are dated, lineup-dependent facts (KIT-D035/D042/D043); the lineup
fact here is that Opus 5 at medium+ effort spends more reasoning than its everyday dispatches
are worth. The ladder is the single home for that judgment, so the change lands here — never
in a per-project memory.
