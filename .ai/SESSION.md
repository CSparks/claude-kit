# SESSION HANDOFF — claude-kit

Updated: 2026-08-04 (evening) | Branch: main @ origin (0381422+) | Active: none between waves

## Current state — drain session, 12 tickets closed (all uat:none, test-backed)
- **Wave 1 (569656d + closes, agent a1071e28):** KIT-T172 (fts FTS5 quoting), T173
  (trail returns decision ids), T174 (fts --scope, cwd-default), T118+T083 (q --help).
  New scripts/q.test.mjs (35). SIDE EFFECTS Chris RATIFIED (KIT-D050): q.mjs 802→417
  split into q-model/q-governing/q-fallback (5e1af45); dup decision ids repaired
  (3768394): KIT-D046/D047 dupes re-keyed → KIT-D048/D049, D049 links→D048.
- **Wave 2 (2965fd3/891647e/b7b249a/f1dcd2b, agent a21ffbff):** KIT-T110 (ONE
  frontmatter parser — t.mjs/id-utils/sync-tasks migrated onto frontmatter.mjs; CRLF
  trap dead), T169 (sync-tasks clean doing-only spec; supersedes T120), T126 (triage
  cap titles ONE line + body content; the 8-item corruption from the morning triage
  cannot recur). criteria.mjs CRLF fix rode along.
- **Wave 3 (d15d632/e7a6a48/ef523aa/a1d33ac, agent af7eabac):** KIT-T164 (hydrate
  gated on the ~/.claude/claude-kit-projects.json registry — unregistered stores no
  longer clobber the shared DB; q dbOpen degrades to markdown scan for unregistered
  roots), T166 (mintId = max(cache, disk, batch); create REFUSES existing ids), T125 +
  T154 closed together (generated views scoped to the project key; no-key = no cache).
  Test isolation repaired in 4 suites (synthetic keys + temp registry).
- **Morning: cross-project triage** (831fd33/233e6b1 + data 8e604fd): 37 caps drained,
  27 created / 7 folded / 1 superseded; KIT-T126 corruption repaired by hand across 8
  items; all 8 provenance proposals declined (named fix/measurement commits as cause).
- **Cache rebuilt clean** (rm .cache/workflow.db + hydrate-db): phantom test-leak
  scopes (DUP/ORI/RCN/S/CLN/SPL/TWP) gone; 1226 items, all 10 data-repo projects
  present. 3 mentions acked (T132#1/T144#2/T151#1). npm test exit 0 after every wave;
  live KIT scope verified intact each time.

## Open threads / new inbox caps (5, awaiting next triage)
- 2026-08-04-1935 superseded reciprocal asymmetry (6 tickets superseded_by w/o
  reciprocal; counts diverge) — medium.
- 2026-08-04-1937 registry holds stale TEMP + agent-worktree entries (kit-budget-J2FaVP
  in AppData\Temp is REGISTERED — weakens the T164 guard) + asset-forge unregistered — high.
- 2026-08-04-1645 (agent) db-cache/reconcile-central suites still stat-touch the live
  cache (re-hydrate, not clobber) — isolation rule violation.
- 2026-08-04-1643 (agent) md-body.appendUnderSection splices LF into CRLF files.

## Next 3 steps
1. Next bug wave candidates: KIT-T111 (ignore-file marker with trailing text), T115
   (worktree cwd guard), T109 (q next-id formatting) — small/mechanical. T105/T106
   (process-failure + commit-hygiene codification) are contract/hook design — present
   before building.
2. KIT-T048 (roadmap top, provenance enforcement) — Chris chose "keep draining bugs"
   first (2026-08-04 questionnaire); when bugs thin out, plan T048 and PRESENT design.
3. Triage the 5 new inbox caps next /triage (registry-hygiene cap is high).

## UAT offered
q fts "no ask-first gate" · q trail KIT-D011 · q fts door vs --scope all · q --help ·
node scripts/sync-tasks.mjs (clean spec) · .ai/SUPERSEDED.md now KIT-only (3 chains).
