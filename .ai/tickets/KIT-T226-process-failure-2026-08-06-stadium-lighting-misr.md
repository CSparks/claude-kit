---
id: KIT-T226
title: Process failure 2026-08-06 (stadium-lighting misroute): root causes in order - (1) interjection routed by session context despite a…
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
created: 2026-08-16T00:06:33.974Z
updated: 2026-08-16T00:35:34Z
---

## Description
Process failure 2026-08-06 (stadium-lighting misroute): root causes in order - (1) interjection routed by session context despite a domain-impossible noun (stadium in an asteroid-mining game); receipt stated the assumption but the spend preceded any chance to catch it; (2) no cross-store probe - the real target project already had another session on the job; (3) the cleanup revert was executed and BUILT inside the maintainer's live checkout (two-writers sin) against his uncommitted WIP, producing false build-break evidence and a broken local HEAD his session then committed onto. Antidotes: KIT-D062 contract step (landed), KIT-T213 mechanical check (todo), and: never run repo-mutating cleanup in a live checkout - worktree or hand the command to the maintainer.

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

Routing half already landed as KIT-D062 (project reality-check, in the interjection routine). The remaining half is now codified at user-config/CLAUDE.global.md, GIT WORKFLOW: never run repo-mutating cleanup (revert/clean/in-place build) in the maintainer's live checkout - worktree, or hand him the command. Mechanical check stays KIT-T213.

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
- [2026-08-16 00:35] (comment) codified as the live-checkout rule in CLAUDE.global.md GIT WORKFLOW [no-test: doctrine]
