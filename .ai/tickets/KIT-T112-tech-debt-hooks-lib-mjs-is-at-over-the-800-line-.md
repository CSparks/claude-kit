---
id: KIT-T112
title: tech-debt: hooks/lib.mjs is at/over the 800-line file-length hard gate (801 on HEAD) — split by concern (registry / store-paths / git-wip / turn-state / memory) per the atomic-files principle. Surfaced during KIT-T016.
type: tech-debt
status: review
priority: low
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
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.692Z
updated: 2026-08-16T01:44:55Z
---

## Description
tech-debt: hooks/lib.mjs is at/over the 800-line file-length hard gate (801 on HEAD) — split by concern (registry / store-paths / git-wip / turn-state / memory) per the atomic-files principle. Surfaced during KIT-T016.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] hooks/lib.mjs is split into by-concern modules under hooks/lib/, each ≤300 lines
- [x] hooks/lib.mjs becomes the one deliberate barrel; its export set is byte-identical to HEAD's
- [x] every importer of hooks/lib.mjs keeps working unchanged (no call-site edits)
- [x] the id-cite atom accepts a digit-bearing scope key (S2-T001), with a commit-gate test
- [x] the suite is green before and after (52 suites; server/server.test.mjs excluded — missing express)

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Baseline the suite; group lib.mjs's 59 exports by concern.
2. Write hooks/lib/<concern>.mjs modules; rewrite lib.mjs as a re-export barrel.
3. Widen ID_CITE_SRC to `[A-Z][A-Z0-9]+-[TDNQRE]\d{1,4}`; add the commit-gate test.
4. Re-run the suite and diff the export set against HEAD.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

hooks/lib.mjs (979 lines) split into 16 by-concern modules under hooks/lib/ — stdin, exec,
config, paths, ids, registry, store-write, git-state, exclusions, maintenance-log,
closure-scans, reminders, turn-state, session, agent-roster, time. Largest is exclusions.mjs
at 152 lines; lib.mjs is now a 32-line barrel. No export renamed, no behaviour changed:
the barrel's runtime export set diffs clean against HEAD's 59 exports, so all 51 importers
keep working unedited.

Also landed the residual one-liner from KIT-T162: ID_CITE_SRC widened from
`[A-Z]{2,}-[TDNQRE]\d{1,4}` to `[A-Z][A-Z0-9]+-[TDNQRE]\d{1,4}` so a digit-bearing scope key
(S2-T001) cites, matching the key grammar in scripts/id-utils.mjs. Purely widening — the old
atom's matches all still match.

Evidence: hooks/commit-gate.test.mjs — 4 new assertions (S2-T001 and KIT-T112 cite; s2-t001
and S-T001 do not); 16 passed. Whole suite re-run before and after: 52 suites, 0 failed
(`npm test` minus server/server.test.mjs, which fails on a missing `express` in this
checkout — pre-existing, unrelated). Also re-ran scripts/agent-pins.test.mjs and
hooks/agent-roster.test.mjs individually: green.

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
- [2026-08-16 01:35] (status) todo → doing
- [2026-08-16 01:44] (status) doing → review
- [2026-08-16 01:44] (comment) split hooks/lib.mjs (979) into 16 modules under hooks/lib/ (max 152 lines); lib.mjs is a 32-line barrel with a byte-identical export set; ID_CITE_SRC widened for S2-T001 with 4 new assertions in hooks/commit-gate.test.mjs (16 passed); full suite 52/52 green
