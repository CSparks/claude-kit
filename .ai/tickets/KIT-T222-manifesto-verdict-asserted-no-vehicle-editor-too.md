---
id: KIT-T222
title: Manifesto verdict asserted 'no vehicle editor tool exists' while ST-T057 (dock/refit/inventory port, todo) sat in the backlog and the…
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
created: 2026-08-16T00:06:32.511Z
updated: 2026-08-16T00:35:27Z
---

## Description
Manifesto verdict asserted 'no vehicle editor tool exists' while ST-T057 (dock/refit/inventory port, todo) sat in the backlog and the sim's refit system was in files read earlier the same session. Root cause: verdict-writing skipped the ground-first step - no q fts against the work store before declaring an absence. Absence claims need the same provenance discipline as identity claims (KIT-T079): a 'does not exist' in any authored doc/decision must cite a store query. Candidate hook: block absence-language in decisions/notes commits without a query receipt. (Chris, stiletto 2026-08-06: 'It's really disappointing when I have to explain shit that should have come out in the fucking wash.')

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

Codified at user-config/CLAUDE.global.md, CONTEXT & PROCESS DISCIPLINE: an absence claim ('no such tool exists') needs the q fts / code-graph query that backs it, or the words 'not checked'. Hook candidate deferred: blocking absence-language in decisions/notes commits without a query receipt is a prose-detection heuristic, not a cheap assertion; doctrine only for now.

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
- [2026-08-16 00:32] (status) todo → doing
- [2026-08-16 00:35] (status) doing → review
- [2026-08-16 00:35] (comment) codified as the absence-claim receipt rule; gate spec deferred in Notes [no-test: doctrine]
