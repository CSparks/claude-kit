---
id: KIT-T124
title: index-tickets.mjs silently fails to parse CRLF ticket frontmatter
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
created: 2026-07-14T17:40:14.730Z
updated: 2026-07-14T17:59:15Z
---

## Description
# index-tickets.mjs silently fails to parse CRLF ticket frontmatter

type: bug
project: groovegrid (found), affects every repo on Windows
captured: 2026-07-14T17:10Z

`readTickets()` extracts frontmatter with `/^---\n([\s\S]*?)\n---/`
(scripts/index-tickets.mjs:56). A ticket whose FIRST line ends `\r\n` (CRLF —
normal on Windows editors / autocrlf checkouts) never matches, so the whole
frontmatter reads as empty and the board renders a junk row: id = filename,
type/status/priority = "—". Two groovegrid tickets (GG-T003, GG-T009) sat
invisible-by-status on the board this way — a review-queue item the drain and
the human /done pass both miss. SILENT failure: no warning is emitted.

Fix: `/^---\r?\n([\s\S]*?)\r?\n---/` + strip `\r` in `field()`/`listField()`
values (`.trim()` already handles trailing `\r`, the delimiter lines are the
real break). Audit the same idiom in db-parse.mjs / q.mjs / t.mjs — t.mjs
WRITES files it read, so it may also preserve/introduce CRLF. Add a
warning when a .md in tickets/ yields no frontmatter (silent junk rows are
how this hid for a month).

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
- [2026-08-02 21:53] (comment) folded from triage: WINDOWS CRLF BREAKS t.mjs FRONTMATTER PARSING - t status / t comment / t tick fail with 'no frontmatter block' on any store file that has CRLF line endings, which on Windows is EVERY file git checks out (core.autocrlf). Files t.mjs itself just wrote are LF and work, so the bug is invisible until you touch an older ticket. MEASURED on hustle-or-die: HOD-T400 (LF, 0 CRLF) updates fine; HOD-T355 (19 CRLF, 8 LF) fails. IMPACT is not cosmetic - this silently prevents ticket status/comment updates on Windows, which is a direct contributing cause of stale statuses (HOD-T400 sat 'doing' 233h; HOD-T355 stayed 'todo' for 17 days after its research doc HOD-R078 was delivered, which in turn caused a downstream process failure where finished research was re-proposed as new work). FIX: normalize line endings before the frontmatter regex in frontmatter.mjs (and audit md-body.mjs / criteria.mjs for the same assumption), plus a regression test with a CRLF fixture. --priority high
- [2026-08-02 21:53] (comment) folded from triage: t.mjs / frontmatter.mjs cannot parse CRLF ticket files: status/comment fail with 'no frontmatter block to update'. Lived: GG-T076..T079 (written 2026-07-14 on Windows) were un-updatable until hand-normalized to LF. Fix: frontmatter parser accepts \r?\n line endings (and/or t.mjs normalizes on write). Note these four also sat in status 'superseded' with empty superseded_by - check whether the CRLF parse failure is HOW they got a wrong status the indexer could not correct.


ADDENDUM (same session): root cause confirmed - claude-kit-data checkouts on this machine run core.autocrlf=true (git warned LF-will-be-CRLF on every ticket file at commit 50d81b2). So ANY fresh checkout / git touch converts ALL ticket files to CRLF and t.mjs stops being able to update them. Fix must be parser-side (accept ?
) AND repo-side (.gitattributes: *.md text eol=lf in claude-kit-data).
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
- [2026-07-14 17:49] (status) superseded → doing
- [2026-07-14 17:59] (status) todo → review
