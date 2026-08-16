---
id: KIT-T111
title: pre-write magic-numbers hook does not honor the file-level 'claude-kit-ignore-file magic-numbers' marker when it has trailing em-dash text (e.g. rg-render common.wgsl line 1) - blocks edits to files that already declare the file-level ignore; block-level start/end markers work
type: bug
status: doing
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
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.690Z
updated: 2026-08-16T00:18:08Z
---

## Description
pre-write magic-numbers hook does not honor the file-level 'claude-kit-ignore-file magic-numbers' marker when it has trailing em-dash text (e.g. rg-render common.wgsl line 1) - blocks edits to files that already declare the file-level ignore; block-level start/end markers work

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] A file-level marker with trailing prose (`— shader constants`) excludes the file
- [x] A marker may name several comma-separated ids; prose after them is never read as one
- [x] The marker is honored on an Edit, not just a whole-file Write
- [x] Documented in hooks/README.md; a real magic number still blocks (negative control)

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Widen the marker id token in `markerExcludedLines` to a comma-list; resolve markers
   against the post-edit file text in pre-write.mjs.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
Two distinct causes behind the one symptom:
1. The id token already tolerated trailing em-dash prose (KIT-T084), but accepted only ONE
   id. `markerExcludedLines` (hooks/lib.mjs) now reads a comma-joined run of ids; prose
   after them still cannot become an id, so `— tuned all by ear` does not smuggle in `all`.
2. The real blocker for the reported .wgsl case: on an **Edit** the gate resolved markers
   against the payload FRAGMENT, which never contains line 1's `ignore-file`. pre-write.mjs
   now reconstructs the post-edit file text once (`postEdit()`) and resolves every
   exclusion against it, mapping the fragment's line numbers by its splice offset. Shared
   with the file-length check, which already did this reconstruction (KIT-T121/T211) —
   one implementation now, not two.

Evidence: `node hooks/exclusions.test.mjs` (new §7/§8 cases + existing controls) and
`node hooks/pre-write.test.mjs`, all pass. The pre-fix hook exits 2 on the same Edit.

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
- [2026-08-16 00:18] (status) todo → doing
