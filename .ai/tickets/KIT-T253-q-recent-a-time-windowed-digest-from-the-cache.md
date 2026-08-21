---
id: KIT-T253
title: "q recent [Nd] [scope] — a time-windowed digest driven from the cache, no prose spelunking"
type: feature
status: review
priority: high
labels: [q, retrieval]
files:
  - scripts/q-recent.mjs
  - scripts/q.mjs
  - scripts/q-fallback.mjs
created: 2026-08-21T02:20:00Z
updated: 2026-08-21T02:20:00Z
---

## Description

Chris 2026-08-21 (verbatim): "there should be a way to drive out a good summary from the
last 3 to 7 days from that system without having to go spelunking in a bunch of prose."

The cache already holds every timestamped event (history: created/status/fixed/decision/
comment; items: created/updated frontmatter). `q recent [Nd] [scope]` renders a DIGEST —
counts and capped lists, not a dump: decisions created in the window, fixed events with
their detail, status transitions, items created. Default 7d; optional scope filter.

## Acceptance Criteria
- [x] `q recent` (no args) digests the last 7 days across all scopes; `q recent 3d ST`
      windows and filters.
- [x] Sections: window header; decisions (all, with titles); fixed (all, with detail);
      status moves (capped, "+N more"); created (capped, "+N more"). Counts always exact
      even when lists cap.
- [x] Fallback parity: the no-DB markdown scan answers the same query from parsed
      history lines (q-fallback case), same row shape.
- [x] Listed in QUERY_SURFACE and the q.mjs header; digest logic lives in its own module
      (scripts/q-recent.mjs), q.mjs wires it thin.

## Notes
Origin: the 2026-08-21 fastnoise relitigation post-mortem — settled facts were
re-derived because surveying "what happened lately" means reading prose. Related
capture: inbox 2026-08-21-0202 (CHOICES.toml into the FTS index).

Bonus fix found by the digest itself: decision files carry frontmatter `date:` and no
## History, so they were invisible to any history-windowed query — db-parse now
synthesizes a `created` event from `created:`/`date:` frontmatter (one home; DB and
fallback both inherit it). Before: 3 decisions in the 7d window; after: 36.

## History
- [2026-08-21 02:20] (created) feature — q recent: time-windowed digest from the cache
- [2026-08-21 02:45] (status) doing → review — tests: scripts/q-recent.test.mjs ok; q 76 passed, db-parity 21 passed, db-cache 66 passed
