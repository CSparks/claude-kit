---
id: KIT-T353
title: Process failure (dedup-before-file, KIT-T025): filed ST-T550 as a duplicate of ST-T489 because the q fts dedup query and the t new were…
summary:               # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
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
fixed_commit: 2b206ff
created: 2026-10-06T14:51:22.484Z
updated: 2026-10-13T02:30:00Z
---

## Description
Process failure (dedup-before-file, KIT-T025): filed ST-T550 as a duplicate of ST-T489 because the q fts dedup query and the t new were fired in the SAME parallel tool call — the dedup result was not read before filing. Root cause: no gate on t new requiring a prior fts in the turn; fix: t new runs q similar itself and refuses/warns on a close title match.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] t new refuses an open near-duplicate (bm25 >= 20 + 2 shared title terms), --not-dup <ids> overrides and is recorded in Notes

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
### comment #1 [2026-10-13 02:25] @claude
Recurrence 2026-10-12 (stiletto): filed ST-T892 via t new with NO q fts first; it duplicated ST-T839 (same failing test, same symptom) and sent a Sonnet agent chasing a wrong cause (~78k tokens). Root cause unchanged: t new does not run the dedup query itself. Fix: t new runs q fts on the title nouns and refuses (or requires --not-dup <id-list>) when an open item scores above threshold.
### comment #2 [2026-10-13 02:29] @claude
Landed d317c03: scripts/t-dedup.mjs (reuses q similar; similar now returns bm25 score), t new wired, readConfig split to t-config.mjs. scripts/t-dedup.test.mjs 10 passed (real ST-T892/ST-T839 pair refused at 25.2, new title passes at 9.5); t.test 109, q.test 109, kit-bug 15 passed. fixed_commit d317c03

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
- [2026-10-13 02:25] (comment) @claude: Recurrence 2026-10-12 (stiletto): filed ST-T892 via t new with NO q fts first; it duplicated ST-T839 (same failing test, (full comment #1 in ## Notes)
- [2026-10-13 02:29] (comment) criterion added: t new refuses an open near-duplicate (bm25 >= 20 + 2 shared title terms), --not-dup <ids> overrides and is recorded in Notes
- [2026-10-13 02:29] (comment) ticked: t new refuses an open near-duplicate (bm25 >= 20 + 2 shared title terms), --not-dup <ids> overrides and is recorded in Notes
- [2026-10-13 02:29] (comment) @claude: Landed d317c03: scripts/t-dedup.mjs (reuses q similar; similar now returns bm25 score), t new wired, readConfig split to (full comment #2 in ## Notes)
- [2026-10-13 02:30] (status) todo → review
- [2026-10-13 03:20] (fixed) d317c03
- [2026-10-13 02:30] (comment) @claude: Correction: the fixing commit is 2b206ff (the earlier comment's d317c03 is the KIT-T355 ticket commit).
- [2026-10-13 03:25] (fixed) 2b206ff
