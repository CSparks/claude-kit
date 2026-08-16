---
id: KIT-T170
title: decisions id/filename convention contradicts itself across the kit — decisions/_TEMPLATE.md says `id: KEY-D000` (per KIT-D011 <KEY>-<TYPE><NUM>), init/docs name the files `DEC-NNN-*.md`, and sync-data's id-integrity check demands id == filename stem — so following the template GUARANTEES a block (gridiron 2026-08-02: DEC-006/007/008 flagged as 'GB-D006' != 'DEC-006'; DEC-001..005 have the same mismatch but were grandfathered — the check only sees recently-touched files). Also its retry hint is wrong boilerplate for this failure mode ("t link <id> regressed_from|causing_commit" for an id mismatch). Pick ONE canon (probably DEC-NNN to match filenames + contract prose), fix the template, and make the checker's message say the actual fix.
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
links: [KIT-T066]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.038Z
updated: 2026-08-16T00:25:58Z
---

## Description
decisions id/filename convention contradicts itself across the kit — decisions/_TEMPLATE.md says `id: KEY-D000` (per KIT-D011 <KEY>-<TYPE><NUM>), init/docs name the files `DEC-NNN-*.md`, and sync-data's id-integrity check demands id == filename stem — so following the template GUARANTEES a block (gridiron 2026-08-02: DEC-006/007/008 flagged as 'GB-D006' != 'DEC-006'; DEC-001..005 have the same mismatch but were grandfathered — the check only sees recently-touched files). Also its retry hint is wrong boilerplate for this failure mode ("t link <id> regressed_from|causing_commit" for an id mismatch). Pick ONE canon (probably DEC-NNN to match filenames + contract prose), fix the template, and make the checker's message say the actual fix.

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
- [2026-08-16 00:25] (status) todo → doing
- [2026-08-16 00:25] (status) doing → review
- [2026-08-16 00:25] (comment) Decisions canon settled as <KEY>-D###-slug.md (KIT-D011, matching this repo's own store): decisions/_TEMPLATE.md now states the <id>-<slug>.md filename rule and drops DEC-###; CLAUDE.md + project-template/CLAUDE.snippet.md say <KEY>-D###-slug.md. The id-integrity messages in commit-gate.mjs and sync-data.mjs now give one hint per failure mode — a MISMATCH says rename-the-file-or-fix-the-id, no longer the t link regression boilerplate. Evidence: scripts/init-project.test.mjs — 32 passed (4 new template-canon assertions incl. a no-DEC-### negative control); hooks/commit-gate.test.mjs — 12 passed (4 hint assertions).
