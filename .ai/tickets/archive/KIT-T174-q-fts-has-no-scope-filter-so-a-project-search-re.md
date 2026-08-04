---
id: KIT-T174
title: q fts has no scope filter, so a project search returns every other project's hits --body q --help shows scope/store filters on SOME subcommands but NOT the one that needs it most: 'open [scope]' takes a scope, 'similar --store <s>', 'sessions --project <s>' — but 'fts <query...>' takes none. Repro from inv4d3rs: 'q fts warp' returned HOD-T224, HOD-T015, GG-T097, HOD-T111, GG-T095, HOD-N001 and ZERO INV rows; 'q fts door' returned 12 rows, all JV/HOD/KIT. Passing a scope as a leading term ('q fts INV warp') does not filter — it is searched as a term and returns nothing. The data supports it: items has a 'scope' column (pragma_table_info confirms id, scope, store, type, status, priority, title, parent, milestone, num, archived, file). Workaround is dropping to 'q sql SELECT ... WHERE scope=...', which is exactly the escape hatch the query-gate exists to make unnecessary. Ask: 'q fts [--scope <s>] <query...>', defaulting to the cwd project's scope when run inside an adopted repo. Cost of the gap: an agent forced onto q by the store-grep gate reads a screen of other projects' tickets and can wrongly conclude its own project has nothing.
type: bug
status: done
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
created: 2026-08-04T15:20:02.059Z
updated: 2026-08-04T16:17:52Z
fixed_commit: 569656d
---

## Description
q fts has no scope filter, so a project search returns every other project's hits --body q --help shows scope/store filters on SOME subcommands but NOT the one that needs it most: 'open [scope]' takes a scope, 'similar --store <s>', 'sessions --project <s>' — but 'fts <query...>' takes none. Repro from inv4d3rs: 'q fts warp' returned HOD-T224, HOD-T015, GG-T097, HOD-T111, GG-T095, HOD-N001 and ZERO INV rows; 'q fts door' returned 12 rows, all JV/HOD/KIT. Passing a scope as a leading term ('q fts INV warp') does not filter — it is searched as a term and returns nothing. The data supports it: items has a 'scope' column (pragma_table_info confirms id, scope, store, type, status, priority, title, parent, milestone, num, archived, file). Workaround is dropping to 'q sql SELECT ... WHERE scope=...', which is exactly the escape hatch the query-gate exists to make unnecessary. Ask: 'q fts [--scope <s>] <query...>', defaulting to the cwd project's scope when run inside an adopted repo. Cost of the gap: an agent forced onto q by the store-grep gate reads a screen of other projects' tickets and can wrongly conclude its own project has nothing.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

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
- [2026-08-04 15:53] (status) todo → doing
- [2026-08-04 16:17] (status) doing → done
- [2026-08-04 16:17] (comment) fixed in 569656d: 'q fts [--scope <s>]' (parseFts in scripts/q-model.mjs, applied on both the cache SQL and the markdown-scan path) defaults to the cwd project's id key and takes --scope all for every project. Tests: scripts/q.test.mjs - parseFts/defaultScope units incl. walk-up-from-a-subdir, plus a two-scope hydrated cache asserting default/explicit/all scope hit sets and scan-path parity. q: 35 passed, 0 failed; full npm test 0 failed.
