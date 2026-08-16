---
id: KIT-T157
title: end-task.mjs rejects --root <path> with an id-resolution error (hit by GG-T084 agent 2026-07-17): agent fell back to plain t status + a review->review end-task, which records the note but never fires the fixed_commit setter â€” so fixed_commit stayed blank. Two defects: (1) --root flag parsing/id resolution in end-task.mjs; (2) fixed_commit setter only runs on a real status TRANSITION, silently skipped on same-status calls. Repro: node end-task.mjs GG-T084 review --note x --root D:\dev\groovegrid.
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: [KIT-T139]           # re-keyed 2026-08-02: KIT-T139 was already claimed by an earlier web-UI ticket
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
created: 2026-07-23T15:42:09.425Z
updated: 2026-08-16T00:23:58Z
fixed_commit: fb99ae4
---

## Description
end-task.mjs rejects --root <path> with an id-resolution error (hit by GG-T084 agent 2026-07-17): agent fell back to plain t status + a review->review end-task, which records the note but never fires the fixed_commit setter â€” so fixed_commit stayed blank. Two defects: (1) --root flag parsing/id resolution in end-task.mjs; (2) fixed_commit setter only runs on a real status TRANSITION, silently skipped on same-status calls. Repro: node end-task.mjs GG-T084 review --note x --root D:\dev\groovegrid.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (â†’review when config.uat: required,
     â†’done when none) requires this ticket to cite a test artifact â€” a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha â€” OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] end-task passes --root, --fixed-commit and --human through; a same-status call writes fixed_commit

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
- [2026-08-16 00:22] (status) todo → doing
- [2026-08-16 00:23] (comment) criterion added: end-task passes --root, --fixed-commit and --human through; a same-status call writes fixed_commit
- [2026-08-16 00:23] (comment) ticked: end-task passes --root, --fixed-commit and --human through; a same-status call writes fixed_commit
- [2026-08-16 00:23] (status) doing → review
- [2026-08-16 00:23] (comment) end-task passes --root/--fixed-commit/--human through; same-status close now writes fixed_commit; evidence: scripts/end-task.test.mjs 9 passed, fixed fb99ae4
