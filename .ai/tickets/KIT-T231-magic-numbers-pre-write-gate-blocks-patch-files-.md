---
id: KIT-T231
title: Magic-numbers pre-write gate blocks .patch files in the scratchpad
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
links: [KIT-T114]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:35.580Z
updated: 2026-08-16T00:20:09Z
---

## Description
# Magic-numbers pre-write gate blocks .patch files in the scratchpad

Captured: 2026-08-07 19:15Z · stiletto-2349 session · type: bug (kit hooks)

Writing a git patch file (single-hunk staging workflow) to the session
scratchpad tripped the `magic-numbers` pre-write gate: a patch BODY quotes the
numeric lines it changes, so any patch touching a tuning value is unwriteable.
Same class as generated/data artifacts: the file is not authored source.

Workaround used (no exclusion added, per contract): skipped the file entirely —
`git diff -- <file> | awk '/^@@/{h++} h<2' | git apply --cached -`.

Decide: should the pre-write gates exclude the session scratchpad directory
(and/or `*.patch`/`*.diff`) globally, or stay strict and bless the pipe-to-apply
idiom as the documented path for partial staging?

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] Writing a `*.patch` / `*.diff` file no longer trips magic-numbers
- [x] The skip is documented in hooks/README.md
- [x] Real source still blocks (negative control in hooks/exclusions.test.mjs)

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Follow the KIT-T114 mechanism (f99ed19): a file-class set in pre-write.mjs, skipped
   with DATA/MARKUP/INFRA before any check runs.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
Fixed by the same mechanism KIT-T114 used for config/infra (commit f99ed19): a `PATCH`
extension set (`patch`, `diff`) joins the classes pre-write.mjs exits on before any check.
A patch body is a QUOTATION of source — none of the checks (magic numbers, rot markers,
SELECT *, file length) mean anything against it.

**Deliberately NOT done — a maintainer policy call:** excluding the session scratchpad
directory (`**/Temp/claude/**/scratchpad/**`) wholesale. That would silence every gate for
every file written there, including real source drafted in the scratchpad, which is a
wider policy than this bug needs. The patch/diff class fix covers the reported case.

Evidence: `node hooks/exclusions.test.mjs` — all pass, including the two new patch/diff
cases and the pre-existing "a bare literal in .ts still blocks" control; the pre-fix hook
exits 2 on the same .patch payload.

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
- [2026-08-16 00:20] (status) doing → review
- [2026-08-16 00:20] (comment) *.patch/*.diff join the skipped file classes; scratchpad-wide exclusion left as a maintainer policy call; hooks/exclusions.test.mjs all pass (b040d70)
