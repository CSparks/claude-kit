---
id: KIT-T162
title: next-id.mjs mints ids that contradict the project's configured prefix: fresh init-project adoption (stiletto-2349, ids.key=S2, ids.prefix=S2-T, pad 3) but `node next-id.mjs tickets` from the repo root printed `S-T001` (after "cache was stale — rehydrated"). Looks like the cross-scope cache/rehydrate path derives the prefix from something other than readIdConfig's key — the '2' is dropped. Also: two sequential calls both return the same id (expected — allocation burns only when a file lands — but worth documenting). Worked around by hand-minting from config.yml; fix at the source. Captured 2026-08-02.

WIDER ROOT CAUSE (same day): the whole id ecosystem rejects digit-bearing keys while init-project happily derives them. `deriveKey("stiletto-2349")` → "S2" (first letters of words), but `ID_CITE_SRC = [A-Z]{2,}-[TDNQRE]\d{1,4}` (hooks/lib.mjs:339) never matches "S2-T001" — so commit-gate BLOCKED a commit correctly citing "implements S2-T001". rekey-ids.mjs then corrupted the store when asked to rekey S2→ST: it parsed bare "S2" as the id and rewrote "S2-T001" to "ST-T002-T001" (renamed one file to ST-T002-T002-*, left the other file named S2-T001-* with mangled frontmatter; config.yml ids block untouched). Repaired by hand; stiletto now keys "ST". Fix candidates: (a) deriveKey skips digit-only words / strips digits and guarantees [A-Z]{2,}; (b) init-project validates the derived key against ID_CITE_SRC; (c) rekey-ids parses ids with the shared atom instead of a bare-key substring. Regression test: adopt a repo named "foo-2000" end-to-end (init → next-id → commit citing the id → rekey).
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-02T21:53:15.851Z
updated: 2026-08-16T00:24:05Z
fixed_commit: fb99ae4
---

## Description
next-id.mjs mints ids that contradict the project's configured prefix: fresh init-project adoption (stiletto-2349, ids.key=S2, ids.prefix=S2-T, pad 3) but `node next-id.mjs tickets` from the repo root printed `S-T001` (after "cache was stale — rehydrated"). Looks like the cross-scope cache/rehydrate path derives the prefix from something other than readIdConfig's key — the '2' is dropped. Also: two sequential calls both return the same id (expected — allocation burns only when a file lands — but worth documenting). Worked around by hand-minting from config.yml; fix at the source. Captured 2026-08-02.

WIDER ROOT CAUSE (same day): the whole id ecosystem rejects digit-bearing keys while init-project happily derives them. `deriveKey("stiletto-2349")` → "S2" (first letters of words), but `ID_CITE_SRC = [A-Z]{2,}-[TDNQRE]\d{1,4}` (hooks/lib.mjs:339) never matches "S2-T001" — so commit-gate BLOCKED a commit correctly citing "implements S2-T001". rekey-ids.mjs then corrupted the store when asked to rekey S2→ST: it parsed bare "S2" as the id and rewrote "S2-T001" to "ST-T002-T001" (renamed one file to ST-T002-T002-*, left the other file named S2-T001-* with mangled frontmatter; config.yml ids block untouched). Repaired by hand; stiletto now keys "ST". Fix candidates: (a) deriveKey skips digit-only words / strips digits and guarantees [A-Z]{2,}; (b) init-project validates the derived key against ID_CITE_SRC; (c) rekey-ids parses ids with the shared atom instead of a bare-key substring. Regression test: adopt a repo named "foo-2000" end-to-end (init → next-id → commit citing the id → rekey).

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] a digit-bearing ids.key (S2) survives config read, scan and mint

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-16 00:22] (status) todo → doing
- [2026-08-16 00:23] (comment) criterion added: a digit-bearing ids.key (S2) survives config read, scan and mint
- [2026-08-16 00:23] (comment) ticked: a digit-bearing ids.key (S2) survives config read, scan and mint
- [2026-08-16 00:24] (status) doing → review
- [2026-08-16 00:24] (comment) readIdConfig + id-shape atoms accept digit-bearing keys (S2-T001); evidence: scripts/id-utils.test.mjs 50 passed, fixed fb99ae4. RESIDUAL: hooks/lib.mjs ID_CITE_SRC still requires [A-Z]{2,} so a commit citing S2-T001 is blocked - the edit was refused by the file-length gate (lib.mjs is 962 lines); needs a split decision. rekey-ids.mjs id atom likewise unfixed.
