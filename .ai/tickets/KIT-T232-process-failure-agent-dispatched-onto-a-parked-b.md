---
id: KIT-T232
title: Process failure: agent dispatched onto a PARKED build's suite — no governing-decision check in the drain
type: bug
status: todo
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T023]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:35.881Z
updated: 2026-08-16T00:06:35.881Z
---

## Description
# Process failure: agent dispatched onto a PARKED build's suite — no governing-decision check in the drain

2026-08-08, gridiron-blitz. GB-T103 ("legacy2d suite not green on main") was
self-captured and immediately drain-dispatched to an opus agent. GB-D009 had
parked the 2D build; Chris had to interrupt ("IT'S FUCKING LEGACY") — now
GB-D018. Root cause: the drain pull and dispatch flow never queried the
governing decisions for the ticket's AREA (q.mjs `governing`/`trail` exist and
were not consulted); a red suite pattern-matched to "suite-health, urgent"
regardless of WHOSE suite. Aggravator: stale convention — prior receipts kept
citing legacy2d counts long after GB-D009, so the parked status was invisible in
recent habit. Enforcement idea: before `status → doing` on a self-captured
ticket, require a `q governing <files>` pass in the dispatch checklist (hookable:
block dispatch receipts lacking it); and when a decision parks an area, the
capture flow should tag the area so triage flags any new ticket touching it.

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
