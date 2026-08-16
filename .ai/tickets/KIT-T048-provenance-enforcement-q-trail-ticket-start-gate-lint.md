---
id: KIT-T048
title: Provenance enforcement — q trail (walk-up summary), ticket-start gate, missing-antecedent lint, item summaries
type: feature
status: todo
priority: high
milestone: M3-provenance
labels: [process, provenance, hooks]
links: [KIT-D028]
files: [scripts/q.mjs]
supersedes:
superseded_by:
created: 2026-06-06T07:50:00Z
updated: 2026-08-16T01:51:17Z
---

## Description
Implement the provenance law ([[KIT-D028]]): make the trail enforced by hooks, not the agent's memory. Inception-out links + trail-on-action, the standard issue-tracker shape (epics/parent/typed links). Surfaced summaries must be token-frugal with a drill-in clue.

## Acceptance Criteria
- [x] `q trail <id>` — walks UP the ancestry (ANCESTOR_RELS: link/parent/supersedes/regressed_from/introduced_by/caused_by), decisions+docs first, robust to prose/junk link targets (id/sha shape only).
- [x] Token-frugal output: clipped one-line gist (80c) + `✎` clue when a node has more detail to drill into; no full-title/body dumps.
- [x] Each item carries a concise `summary:` frontmatter (parser exposes it; `q trail` prefers it over the clipped title). Backfill summaries on key decisions.
- [x] Ticket-start gate: when a ticket flips to `doing`, surface its trail; BLOCK acting on a trail-less item (no outbound antecedent link).
- [x] Missing-antecedent lint: flag any item with no outbound antecedent link (orphan in the provenance graph).
- [ ] Research/design docs indexed as trail nodes (depends on KIT-T041/T042) so docs (e.g. R050) appear in trails.
- [x] `q trail` exposed in orient for the in-flight `doing` ticket.

## Plan
1. [done] `q trail` walk-up + token-frugal output (scripts/q.mjs).
2. summary field convention + parser + backfill.
3. ticket-start gate hook + missing-antecedent lint.
4. doc indexing (KIT-T041/T042) so docs join trails.

## Notes
- 2026-06-06: `q trail` shipped and dogfooded on HOD-T106 — it PROVES the failure that started this: T106's trail surfaces D015/D017/D010/D016… but NEVER reaches HOD-D003 (Rust owns world-gen), because the inception-out link to D003 was never authored; it also flags HOD-D007 as dangling and the wrong HOD-D017 in the chain. Data reconciliation (link T106/T107→D003, dispose of D017) is maintainer-gated (edits were halted).
- 2026-06-09: was stale `doing` (phase 1 shipped in 4448742; no active work). Re-queued `todo` under M3-provenance — remaining criteria (summary frontmatter, ticket-start gate, antecedent lint, doc indexing, orient exposure) are M3 scope alongside KIT-T065/T066; doc-indexing criterion stays gated on KIT-T041/T042.
- 2026-08-15: phase 2 landed. `summary:` frontmatter parses (db-parse), rides the cache (schema v4 adds
  `summary` + `body_len`), and `q trail` / begin-task / governing-brief prefer it over the clipped title;
  backfilled on KIT-D028/D044/D050/D059/D061/D062/D063 (D064 has no frontmatter block yet, so it was left
  alone). New `scripts/provenance.mjs` owns the antecedent rules; `q orphans [scope]` is the lint (cache +
  markdown-scan, at parity); `t status <id> doing` prints the trail and checks it; orient replays the trail
  for each in-flight `doing` ticket.
- DELIBERATE DEVIATION from the criterion text ("BLOCK acting on a trail-less item"): the gate WARNS by
  default and blocks only where `.ai/config.yml` sets `provenance.gate: block`. A promoted capture arrives
  link-less by construction, so a default block would wedge every freshly-filed bug at its first transition.
  Block mode has an escape: `t status <id> doing --no-trail-check "<reason>"`, which is printed, never silent.
  Flip the kit to `block` whenever the store is clean enough — that is the maintainer's call.
- Criterion 4 (docs as trail nodes) stays OPEN: KIT-T041 (index research/design docs) is `superseded` and
  nothing indexes `docs/research`, so there is no doc node for a trail to reach. Unblocks when a docs/research
  store is indexed.
- Evidence: scripts/q.test.mjs (76 passed — orphans both paths + summary preference + negative controls),
  scripts/t.test.mjs (109 passed — trailGate warn/block/escape + CLI), scripts/begin-task.test.mjs (39 passed),
  hooks/orient-trail.test.mjs (5 passed, new). Full `npm test` green except server/server.test.mjs, which
  cannot run in this worktree (express is not installed in the checkout) — unrelated to this change.

## History
- [2026-08-16 01:26] (status) todo → doing
- [2026-08-16 01:28] (status) doing → doing
- [2026-08-16 01:50] (comment) ticked: Each item carries a concise `summary:` frontmatter (parser exposes it; `q trail` prefers it over the clipped title). Backfill summaries on key decisions.
- [2026-08-16 01:50] (comment) ticked: Ticket-start gate: when a ticket flips to `doing`, surface its trail; BLOCK acting on a trail-less item (no outbound antecedent link).
- [2026-08-16 01:50] (comment) ticked: Missing-antecedent lint: flag any item with no outbound antecedent link (orphan in the provenance graph).
- [2026-08-16 01:50] (comment) ticked: `q trail` exposed in orient for the in-flight `doing` ticket.
- [2026-08-16 01:51] (status) doing → todo
- [2026-08-16 01:51] (comment) provenance phase 2 landed: summary frontmatter + cache column, q orphans lint, t status doing trail gate (warn default / block opt-in / --no-trail-check escape), orient trail replay. Tests: q 76, t 109, begin-task 39, orient-trail 5 (new). Criterion 4 (docs as trail nodes) left OPEN - KIT-T041 is superseded and docs/research is still unindexed.
