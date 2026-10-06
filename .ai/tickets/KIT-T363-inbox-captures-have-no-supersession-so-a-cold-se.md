---
id: KIT-T363
title: Inbox captures have NO SUPERSESSION, so a cold session cites a dead one as governing. Tickets and decisions carry status (superseded,…
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
created: 2026-10-06T14:51:23.343Z
updated: 2026-10-06T14:51:23.343Z
---

## Description
Inbox captures have NO SUPERSESSION, so a cold session cites a dead one as governing. Tickets and decisions carry status (superseded, etc.) and q surfaces it; raw inbox captures do not. They land flat, a later capture silently overrules an earlier one, and q inbox lists them as equals with no marker and no link. LIVED FAILURE 2026-09-06 (stiletto-2349): the 17:30 capture ('parts are always meshkit-modelled, so a Meshy GLB cannot be a shipped asset source') was superseded by a 19:05 decision the SAME EVENING. At 21:00 a cold session read the inbox, quoted the 17:30 premise as binding, and told the maintainer a design was blocked by it - while the governing decision (RG-D051, 2026-08-21, 'one mechanism at every altitude') sat in the decisions store unread. Cost: an hour of the maintainer re-arguing a settled decision, and it is the SECOND time this shape of failure has been recorded (see the process-failure trigger in CLAUDE.md: 'lose or re-derive a fact already in the durable record'). ROOT CAUSE: retrieval treats every inbox item as live because nothing can mark one dead. FIX SHAPES, cheapest first: (1) cap gains a supersedes/superseded-by link and q inbox renders it inline and dims/flags the dead one; (2) q inbox warns when two captures in the same window share nouns, the way dedup already does on filing; (3) triage is the real answer - an item that sat un-triaged for hours is the vulnerable window, so surface age-in-window prominently. NOTE the ratchet already nags on un-triaged age but that nag did not prevent citing a stale item as authoritative.

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
