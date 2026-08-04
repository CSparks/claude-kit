---
id: KIT-T110
title: tech-debt: consolidate frontmatter parsing — the field() YAML inline-comment-strip bug fixed in index-tickets.mjs (KIT-T063) exists latently in t.mjs, reconcile-supersede.mjs, id-utils.mjs, sync-tasks.mjs. One shared frontmatter helper (KIT-T059-style) prevents recurrence.
type: tech-debt
status: doing
priority: low
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
created: 2026-07-14T17:40:14.686Z
updated: 2026-08-04T16:23:54Z
---

## Description
tech-debt: consolidate frontmatter parsing — the field() YAML inline-comment-strip bug fixed in index-tickets.mjs (KIT-T063) exists latently in t.mjs, reconcile-supersede.mjs, id-utils.mjs, sync-tasks.mjs. One shared frontmatter helper (KIT-T059-style) prevents recurrence.

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
- [2026-08-04 15:20] (comment) folded from triage: t.mjs still has its own LF-only frontmatter regex — a CRLF ticket is silently unwritable (KIT-T110 unfinished) --body Repro in inv4d3rs: rewrote 4 ticket files with a Windows text-mode write (LF -> CRLF), after which EVERY t.mjs mutation on them failed with 'INV-T021: no frontmatter block to update' (t status / t tick / t comment all dead). Same commands worked fine on untouched LF tickets. Converting the files back to LF fixed it instantly. Root cause: frontmatter.mjs is the ONE CRLF-tolerant parser (/^---\r?\n/) and its own header comment says 'KIT-T110 finishes the job for t.mjs/sync-tasks/id-utils' — t.mjs's findTicket was never migrated and still uses an LF-only block match, which is the exact bug class KIT-T124 already fixed elsewhere (junk board rows, duplicate-id aborts). Impact: on Windows this is a live trap — any editor, script, or autocrlf checkout that writes CRLF makes a ticket permanently unwritable through the CLI, and the error names frontmatter (which LOOKS present and valid on inspection) rather than line endings, so it reads as file corruption. Fix: migrate t.mjs (and sync-tasks.mjs, id-utils.mjs) to import splitFrontmatter/frontmatterBlock from frontmatter.mjs and delete the local copies.
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
- [2026-08-04 16:23] (status) todo → doing
