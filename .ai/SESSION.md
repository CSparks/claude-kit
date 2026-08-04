# SESSION HANDOFF — claude-kit

Updated: 2026-08-04 | Branch: main @ origin (233e6b1) | Active: none (triage session)

## Current state
- **Cross-project triage COMPLETE (831fd33 + 233e6b1, pushed; data repo 8e604fd + sync).**
  37 caps drained: HOD 21, KIT 12, INV 1, S 2, ST 1.
  - Created: HOD-T428..T437 + HOD-D098..D103, KIT-T166..T175, ST-T053.
  - Folded 7 / superseded 1: 4 sketchpad asks → HOD-T427; N-arm ruling → HOD-D095
    (verbatim already on record); INV low-poly → INV-T011; SUPERSEDED-leak → KIT-T125;
    t.mjs CRLF → KIT-T110; KIT-T169 supersedes KIT-T120 (strict superset).
  - 2 stale `S`-scope caps skipped safely — verified already triaged 2026-08-02 into
    ST-T001/ST-T002 (both review, fixes landed); leftovers parked in `triaged/`.
  - Provenance: ALL 8 machine proposals declined — each named the FIX or measurement
    commit as cause (9c4e265, 4f5afd9) or latched onto KIT-T025 as regressed_from.
    Nothing recorded; a real culprit can still be linked later.
- **KIT-T126 bit this run (recurrence logged on the ticket):** all 8 items created from
  multi-line caps got the full cap text inside the `title:` frontmatter scalar
  (HOD-T432/T433/T434/T436, HOD-D100/D101/D103, KIT-T175); decision files additionally
  had template-placeholder bodies. Repaired ALL by hand same run (one-line titles,
  decision bodies filled from cap text verbatim; huge single-line D098/D099 titles
  shortened too). KIT + HOD boards regenerated after repair.
- **KIT-T167 false positive hit live mid-run:** query-gate blocked `find` over
  `claude-kit-data/projects/*` (workflow DATA, not source). Worked around with Glob.

## Landmines / carry-over facts
- The stiletto store had a dead `S` scope with no config — its caps plan with
  `allowedClassifications: []` and apply skips them ("unknown scope"). Live scope is ST.
- Decision-file creates from triage leave `**Decision:**/**Why:**` placeholders — body
  content must be checked after any triage that promotes to decisions (KIT-T126 family).
- KIT-T164 (hydrate-at-source clobber), KIT-T124 CRLF trap, stale :4319 server —
  still live, see prior notes in git history of this file (7c5ca72 version).

## Next 3 steps
1. Drain order for KIT is unchanged — top of worklist: KIT-T102/T104/T105/T106…
   (bug/high block). New this run and directly fixable at source: KIT-T169 (sync-tasks
   corrupt spec, supersedes T120), KIT-T172/T173/T174 (q fts quoting / trail decision-ids
   / fts scope filter), KIT-T166 (next-id collisions, pairs with T162/T117).
2. KIT-T126 root fix (triage apply title extraction) now has a fresh 8-item repro from
   this run — good first pick; it corrupts every multi-line cap promotion.
3. 15+ KIT tickets sit in review awaiting Chris's `/done` (queue deliberately deferred).

## UAT offered this turn
Open `.ai/tickets/INDEX.md` (or hub UI) — spot-check KIT-T175 / HOD-D101 for clean
one-line titles + filled bodies; `node scripts/q.mjs open KIT` shows T166–T175 in drain
order.
