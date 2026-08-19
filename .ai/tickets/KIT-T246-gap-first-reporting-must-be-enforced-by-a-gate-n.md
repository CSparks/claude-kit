---
id: KIT-T246
title: GAP-FIRST REPORTING must be enforced by a gate, not by intention. Recurring failure: work is reported in its most favourable framing and…
summary:               # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
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
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-19T03:56:31.692Z
updated: 2026-08-19T03:56:31.692Z
---

## Description
GAP-FIRST REPORTING must be enforced by a gate, not by intention. Recurring failure: work is reported in its most favourable framing and the unstated gap rides until Chris asks. Observed twice in one session (stiletto 2026-08-16): (1) landed 'stiletto's HUD consumes the framework' when one module of a dozen moved, the radar's 659 lines were untouched, and the dial component written that same day sat unused — surfaced only when Chris asked twice; (2) immediately after being corrected, dispatched four component agents with NO consuming-game migration in their briefs, so criterion 5 (the consumer measurably shrinks) was unprovable by construction — surfaced only when Chris asked again. ROOT CAUSE: the correction lived in prose, so it did not survive into the next dispatch. Wanted: (a) every landing report LEADS with what did NOT get done / what is still hand-rolled; (b) a framework/extraction/component claim is INVALID without a named consumer migrated onto it, or must be reported as UNPROVEN in the same breath; (c) enforce via the land-alert gate — require a GAP: line (or an explicit [no-gap: reason]) alongside the UAT receipt; (d) any agent brief that creates a reusable component must include migrating at least one real consumer, or state why not. Chris 2026-08-16: 'I smell lying through omission really well these days' / 'We need rules to prevent that bullshit.'

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
