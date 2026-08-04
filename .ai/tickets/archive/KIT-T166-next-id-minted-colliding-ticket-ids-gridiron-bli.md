---
id: KIT-T166
title: next-id minted colliding ticket IDs — gridiron-blitz triage on 2026-07-14 re-minted GB-T001..T005 over the existing 2026-06 GB-T001..T006 (five duplicate-id ticket files sat on the board for 3 weeks; INDEX silently showed only one set). Renumbered by hand to GB-T007..T011 on 2026-08-02. Root cause needs kit-side investigation: counter likely derived from stale/other-machine state (macOS↔Windows shared data repo) or a leftover of the ids.key KEY→GB rename (see gridiron SESSION.md 2026-06-03 note). next-id must derive from the max existing id in tickets/ at mint time, and triage should refuse to create a file whose id already exists.
type: bug
status: done
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T162, HOD-T295]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.010Z
updated: 2026-08-04T20:50:32Z
fixed_commit: e7a6a48
---

## Description
next-id minted colliding ticket IDs — gridiron-blitz triage on 2026-07-14 re-minted GB-T001..T005 over the existing 2026-06 GB-T001..T006 (five duplicate-id ticket files sat on the board for 3 weeks; INDEX silently showed only one set). Renumbered by hand to GB-T007..T011 on 2026-08-02. Root cause needs kit-side investigation: counter likely derived from stale/other-machine state (macOS↔Windows shared data repo) or a leftover of the ids.key KEY→GB rename (see gridiron SESSION.md 2026-06-03 note). next-id must derive from the max existing id in tickets/ at mint time, and triage should refuse to create a file whose id already exists.

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
- [2026-08-04 20:20] (status) todo → doing
- [2026-08-04 20:50] (status) doing → done
- [2026-08-04 20:50] (comment) Allocators now take the max of disk and cache, never the cache alone: id-utils gains maxStoreNum/formatItemId/idExists/fileForId; next-id.mjs takes max(disk,cache) and only trusts a cache id carrying this project's key+letter; triage's allocator is the exported mintId = max(cache, disk, batch high-water). Create paths REFUSE a taken id (writeFromTemplate + t new) naming the file they would have shadowed; in --apply a refusal fails that cap only, cap stays in the inbox with the error in its receipt. Test scripts/id-collision.test.mjs (11 passed): with a frozen cache that knows one ticket and five more on disk, next-id answered TST-T002 (an existing file) BEFORE and TST-T007 AFTER. npm test green: 886 harness assertions + 43 node:test, 0 failed. fixed e7a6a48
