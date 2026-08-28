---
id: KIT-N007
title: (request, done in same commit) Maintainer directive 2026-08-21: trim and compact the
created: 2026-08-28T22:01:34.391Z
links: []
---

(request, done in same commit) Maintainer directive 2026-08-21: trim and compact the
composed ~/.claude/CLAUDE.md — bare kit init should budget 5-10K tokens. Trimmed
user-config/CLAUDE.global.md: stripped quoted maintainer remarks, dates/attributions,
and duplicated rationale; every rule and ticket id preserved. Measured with the local
llama tokenizer: composed CLAUDE.md 5875 -> 4610 tokens; total kit-attributable init
(CLAUDE.md + skill/agent/command descriptions) 7675 -> 6410. Deeper cuts possible only
by paraphrasing rules harder (nuance risk) — not taken without a further directive.

<!-- One note per file (atomic — KIT-D009). IDs KIT-N### (e.g. KIT-N001). Allocate with
     next-id.mjs (KIT-T009). Observations the router classifies as `notes` land here. -->
