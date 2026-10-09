---
id: KIT-T401
title: SessionStart hooks take too long on a clean context (/clear): orientation output is 132 KB and the hooks run slowly before the first prompt
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T20:27:51Z
updated: 2026-10-09T20:54:23Z
---

## Description
SessionStart hooks take too long on a clean context (/clear): orientation output is 132 KB and the hooks run slowly before the first prompt is handled (Chris 2026-10-09, stiletto-2349)

kit-bug-shape: cap:bug:sessionstart-hooks-take-too-long-on-a-clean-cont
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Per-hook wall time and output size measured for D:devstiletto-2349 (before: orient 11.1 s / 137,813 B, housekeeping 2.0 s / 1,325 B)
- [x] Orientation output capped inside the harness inline budget (9,500 chars) with the untruncated text on disk and named in each shortened block (after: ~8.5 KB)
- [x] Dominant costs fixed at the root: stat-keyed caches for ticket heads, parsed items, decision meta, kit-bug listing; build-tree byte total cached; git fetch throttled and parallel; broker results read only when newer
- [x] Kit suite green (see Notes)

## Plan
Measure, then remove the opens (~0.4 ms each on this box) and the unbounded sections.

## History
- [2026-10-09 20:27] (created) bug — SessionStart hooks take too long on a clean context (/clear): orientation output is 132 KB and the hooks run slowly before the first prompt
- [2026-10-09 20:33] (status) todo → doing
- [2026-10-09 20:54] (status) doing → review

## Notes
Measured with cwd D:devstiletto-2349, stdin {"hook_event_name":"SessionStart","source":"clear"}, via hooks/compat-run.mjs. Hooks registered at SessionStart: orient.mjs and housekeeping.mjs (hooks/hooks.json); ~/.claude/settings.json registers none.
- orient.mjs: 11.1 s / 137,813 B -> ~1.1 s warm / 8,481 B (2.0 s with a cold fetch stamp).
- housekeeping.mjs: 2.0 s / 1,325 B -> ~0.5 s / 1,326 B.
Root causes: 25+ `doing`/`review` ticket lines and a per-ticket trail query (each ~150 ms) = 5.4 s and ~95 KB; broker deferred list 26 KB; mentions + governing each re-parsed all 1,164 store files (~1 s each); closure scans opened 881 tickets twice (~0.4 s each); git fetch 0.8-1.9 s; deps byte total statted 49k artifacts (0.7 s); decision metas re-read per call.
Fix: hooks/lib/stat-cache.mjs (stat-keyed per-file memo) behind scanReviewQueue/scanStaleDoingTickets, scripts/items-cache.mjs (q fallback scans), orient decision metas, openKitBugs; fetchRepos (parallel, 5 min throttle); deps byte total cached 24 h (shown as ~); broker result files filtered by mtime; orient caps (in-flight 5, trails 2, mentions 3, deferred 4, line clip 120); hooks/lib/orient-budget.mjs demotes low-priority blocks to header + pointer when over 9,500 chars and writes the full text to .cache/orient-<project>.txt.
Tests: hooks/stat-cache.test.mjs (8 passed: cache hit/miss/corrupt, scan invalidation, item-cache parity, budget unit tests, orient e2e on 40 review tickets <= 10,000 chars); npm test chain all green except server tests (pre-existing: 'express' not installed); t.test 109 passed on rerun (first run tripped the live-cache mtime check while other sessions were active). [no-test: none, tests cited above]
