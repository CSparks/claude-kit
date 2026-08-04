---
id: KIT-T168
title: code-graph is JS/TS-only and in a rewritten repo it silently serves the SUPERSEDED tree as authoritative — gridiron-blitz is now a Rust app at root src/ (46 .rs files) with the old TS app moved to legacy/, and code-graph answers `entry-points` and `defines checkTackleAndScore` from legacy/ with zero warning (2026-08-02). KIT-T085 already carve-outs rust greps, but the "query the graph FIRST" mandate + query-gate steer straight into stale answers here. Wanted, in order of value: (1) WARN when the indexed tree is confined to a legacy*/ subtree or when the majority language of the repo is un-indexed; (2) `surface <path>` on a nonexistent path should say path-not-found, not return [] (silent-empty reads as "no public surface"); (3) Rust indexing (even symbols-only via tree-sitter) so graph-first works in Rust repos.
type: feature
status: todo
priority: medium
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T101]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.026Z
updated: 2026-08-04T15:20:02.026Z
---

## Description
code-graph is JS/TS-only and in a rewritten repo it silently serves the SUPERSEDED tree as authoritative — gridiron-blitz is now a Rust app at root src/ (46 .rs files) with the old TS app moved to legacy/, and code-graph answers `entry-points` and `defines checkTackleAndScore` from legacy/ with zero warning (2026-08-02). KIT-T085 already carve-outs rust greps, but the "query the graph FIRST" mandate + query-gate steer straight into stale answers here. Wanted, in order of value: (1) WARN when the indexed tree is confined to a legacy*/ subtree or when the majority language of the repo is un-indexed; (2) `surface <path>` on a nonexistent path should say path-not-found, not return [] (silent-empty reads as "no public surface"); (3) Rust indexing (even symbols-only via tree-sitter) so graph-first works in Rust repos.

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
