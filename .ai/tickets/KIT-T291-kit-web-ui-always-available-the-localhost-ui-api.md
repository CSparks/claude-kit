---
id: KIT-T291
title: Kit web UI always available: the localhost UI/API (server/, 127.0.0.1:4319) starts automatically like the resident q server (KIT-T290) — ideally one resident kit process serving both — and gains a search page over the q index (code, tickets, docs, configs, with q's filters); orient prints its URL; express dependency installed by bootstrap so server.test.mjs runs (Chris 2026-10-02: 'I should be using that more often')
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T16:54:11Z
updated: 2026-10-02T16:54:11Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-02 16:54] (created) feature — Kit web UI always available: the localhost UI/API (server/, 127.0.0.1:4319) starts automatically like the resident q server (KIT-T290) — ideally one resident kit process serving both — and gains a search page over the q index (code, tickets, docs, configs, with q's filters); orient prints its URL; express dependency installed by bootstrap so server.test.mjs runs (Chris 2026-10-02: 'I should be using that more often')
- [2026-10-02 16:55] (comment) @claude: Chris 2026-10-02: q and the other kit commands (t, cap, orient queries) should go THROUGH the resident API, so using the (full comment #1 in ## Notes)
### comment #1 [2026-10-02 16:55] @claude
Chris 2026-10-02: q and the other kit commands (t, cap, orient queries) should go THROUGH the resident API, so using the kit at all brings the whole service (index, API, web UI) up — a dependency chain, not separate daemons. Constraints: ONE resident kit process; every CLI a thin client that auto-starts it; hooks keep an in-process fallback so a dead server never blocks a hook (fail open); markdown stays the write record (KIT-D024/D044), the API writes through the existing store code; prefer zero-dep node:http over express so the resident core has no install step.
