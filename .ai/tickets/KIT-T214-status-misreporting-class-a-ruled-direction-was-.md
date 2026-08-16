---
id: KIT-T214
title: Status misreporting class: a RULED direction was presented as IMPLEMENTED reality. Case: HOD recipe model - HOD-R080 (road-data-model.md,…
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
created: 2026-08-16T00:06:29.529Z
updated: 2026-08-16T00:06:29.529Z
---

## Description
Status misreporting class: a RULED direction was presented as IMPLEMENTED reality. Case: HOD recipe model - HOD-R080 (road-data-model.md, maintainer rulings 2026-07-14) outlines compound recipes with arm SLOTS binding other recipes + solvers; only Layer-1 P0 was ever built (roadClasses + elements[]), and the doc itself says Layer 2 is 'next phase'. Yet cross-session references (incl. stiletto ST-D014 lineage phrasing 'the flexible recipe data model the HTML editor already speaks') read as if the flexible model existed. Discovered by the stiletto recipe harvest 2026-08-06; Chris: 'I spent a lot of fucking time outlining that direction in HOD and it sure as fuck was presented as if it had been implemented.' ROOT CAUSE: no evidence floor on IMPLEMENTED claims in summaries/decisions - tickets have the KIT-T061 test-artifact floor, but decision/summary prose can assert built-ness with zero grounding. Fix direction: summaries/decisions that claim a capability exists must cite the implementing commit/test the way ticket closings do.

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
