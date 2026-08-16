---
id: KIT-T232
title: Process failure: agent dispatched onto a PARKED build's suite — no governing-decision check in the drain
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
links: [KIT-T023]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:35.881Z
updated: 2026-08-16T00:39:57Z
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
- [x] begin-task's brief carries a "GOVERNING DECISIONS — read before dispatch" block, built from `q governing <ticket files>` + `q trail <id>` (decisions only)
- [x] a decision whose title/body says parked/deferred/legacy/superseded/frozen is flagged `!! PARKED?`
- [x] commands/drain.md step 2 requires reading that block; a parked-governed ticket is never auto-dispatched — `next up: <id> — your call: governed by <D-id> (parked)`
- [x] fixture-tested: a decision governing the ticket's declared files surfaces + is flagged; an unrelated decision does not

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
begin-task already emitted a "Governing trail" (ancestry only, unflagged) — the delta is the
file-scoped governance query plus the parked flag. Logic lives in the new scripts/governing-brief.mjs.
One upstream fix was needed: q-governing's pathCovered ignored a directory query against a glob
under it, so a ticket with `files: [src/legacy2d]` missed the decision governing `src/legacy2d/*`;
containment is now symmetric for globs, matching the non-glob branch. Evidence:
scripts/begin-task.test.mjs — 36 passed (8 new); scripts/q.test.mjs — 71 passed (no regression).

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
- [2026-08-16 00:36] (status) todo → doing
- [2026-08-16 00:39] (status) doing → review
- [2026-08-16 00:39] (comment) begin-task GOVERNING DECISIONS block with !! PARKED? flags + drain.md gate; begin-task.test.mjs 36 passed, q.test.mjs 71 passed
