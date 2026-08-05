---
id: KIT-D055
title: Docs lookup order inverted — kit KB first, context7 last; DB-cache the KB if it speeds lookups
date: 2026-08-05
supersedes:
source: conversation 2026-08-05 ("Definitely invert the lookup order, cache it in the DB if that makes look ups faster.")
---

**Decision:** Library/API documentation lookups follow this order in every session:
(1) kit knowledgebase (`docs/research/`), (2) training knowledge, (3) web search,
(4) context7 LAST — reserved for version-fragile or post-cutoff facts a free source
couldn't settle. Any context7 answer worth the paid call gets distilled into the KB
the same turn. The KB may be indexed into the kit's existing DB read-cache
(KIT-D044 pattern: markdown stays the truth, DB is a projection) if that makes
KB-first lookups measurably faster — implementer's call at build time.

**Why:** Context7 cut its free tier ~92% (≈6,000 → 1,000 req/mo, Jan 2026; paid
$10/mo) while its MCP server instructions still push maximal use ("use even when
you think you know the answer; prefer over web search"). Under metering, every
uncached call is a spend that leaves nothing behind; KB-first makes each paid call
a one-time acquisition cost. Rejected: uninstalling context7 outright — 1,000
req/mo is a useful buffer for genuinely fresh facts once demand drops.
