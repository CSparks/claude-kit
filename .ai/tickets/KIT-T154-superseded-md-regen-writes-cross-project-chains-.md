---
id: KIT-T154
title: SUPERSEDED.md regen writes cross-project chains into project-template â€” end-task/reconcile board regen added DUP-T005â†’DUP-T001 and RCN-T001â†’RCN-T002 (and earlier GG-T015â†’GG-T014) to project-template/.ai/SUPERSEDED.md, which init-project ships to new repos. Root cause family = KIT-T125 (cross-project writes into the template tree): the regenerator globs supersede chains across ALL known projects instead of scoping to the owning project root. Noticed 2026-07-15 when KIT-T127's end-task regen dirtied the template; polluted lines reverted in the follow-up commit, but they will bounce back on every regen until the scoping bug is fixed at the source.
type: bug
status: todo
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: [KIT-T136]           # re-keyed 2026-08-02: KIT-T136 was already claimed by an earlier web-UI ticket
parent:                # id of the parent item (epic/request) this belongs to â€” upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds â€” reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep â€” expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku â€” pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max â€” pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-23T15:42:09.412Z
updated: 2026-07-23T15:42:09.412Z
---

## Description
SUPERSEDED.md regen writes cross-project chains into project-template â€” end-task/reconcile board regen added DUP-T005â†’DUP-T001 and RCN-T001â†’RCN-T002 (and earlier GG-T015â†’GG-T014) to project-template/.ai/SUPERSEDED.md, which init-project ships to new repos. Root cause family = KIT-T125 (cross-project writes into the template tree): the regenerator globs supersede chains across ALL known projects instead of scoping to the owning project root. Noticed 2026-07-15 when KIT-T127's end-task regen dirtied the template; polluted lines reverted in the follow-up commit, but they will bounce back on every regen until the scoping bug is fixed at the source.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (â†’review when config.uat: required,
     â†’done when none) requires this ticket to cite a test artifact â€” a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha â€” OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress â€” free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

## History
<!-- structured event log â€” APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo â†’ doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen â€” cross-cut ones also go in DECISIONS.md
       (blocker)   <title> â€” open          (unblocked) <title> â€” <resolution>
       (fixed)     <sha>                    (regressed) â†’ T-040   (recurred as)
     NEVER edit or delete a prior line â€” this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
