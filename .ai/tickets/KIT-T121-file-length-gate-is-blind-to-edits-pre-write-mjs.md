---
id: KIT-T121
title: file-length gate is BLIND to Edits: pre-write.mjs line 116 measures content ?? new_string, so on Edit the check sees the inserted FRAGMENT length, never the resulting file — hod-chunkgen corridor.rs grew to 2939 lines (block is 600) through Edits without a single warn (maintainer caught it, 2026-07-06). Fix: for file-length on Edit, read file_path from disk and assert post-edit length (old lines − old_string lines + new_string lines); keep fragment scope for the other line-keyed checks. Pair with a policy for existing over-limit files (shrink-only or scheduled splits) so the fix doesn't wedge active repos
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
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.721Z
updated: 2026-08-02T21:57:51Z
---

## Description
file-length gate is BLIND to Edits: pre-write.mjs line 116 measures content ?? new_string, so on Edit the check sees the inserted FRAGMENT length, never the resulting file — hod-chunkgen corridor.rs grew to 2939 lines (block is 600) through Edits without a single warn (maintainer caught it, 2026-07-06). Fix: for file-length on Edit, read file_path from disk and assert post-edit length (old lines − old_string lines + new_string lines); keep fragment scope for the other line-keyed checks. Pair with a policy for existing over-limit files (shrink-only or scheduled splits) so the fix doesn't wedge active repos

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] file-length judges the post-edit file, not the Edit fragment (covered by hooks/exclusions.test.mjs)

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
### comment #1 [2026-08-02 21:57] @claude
Fixed. pre-write.mjs sized `content ?? new_string`, so on an Edit the gate measured the replacement FRAGMENT and never the resulting file — which is how corridor.rs reached 2939 lines against a 600 hard limit without one warn. The file-length check now reconstructs the post-edit text from disk (index-based string surgery, never String.replace, so a $& or $1 in the replacement is inserted literally instead of expanding as a substitution pattern) and judges that. replace_all uses split/join for the same reason.
Deliberately scoped to file-length ONLY: the other checks stay fragment-scoped because they are line-keyed at the diff, and re-scanning whole files would block an unrelated edit on pre-existing violations. Fail-open preserved — an unreadable or not-yet-created file falls back to the fragment, and a stale (non-matching) old_string leaves the text unchanged.
EVIDENCE: 4 new cases in hooks/exclusions.test.mjs — a 2-line Edit onto a 700-line file now BLOCKS (exit 2), the same Edit onto a small file is allowed, an over-limit fragment landing in a small file is allowed, and a non-matching Edit does not block. npm test exit 0, 136 passed / 0 failed.

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
- [2026-08-02 21:57] (comment) criterion added: file-length judges the post-edit file, not the Edit fragment (covered by hooks/exclusions.test.mjs)
- [2026-08-02 21:57] (comment) ticked: file-length judges the post-edit file, not the Edit fragment (covered by hooks/exclusions.test.mjs)
- [2026-08-02 21:57] (comment) @claude: Fixed. pre-write.mjs sized `content ?? new_string`, so on an Edit the gate measured the replacement FRAGMENT and never t (full comment #1 in ## Notes)
- [2026-08-02 21:57] (status) todo → review
