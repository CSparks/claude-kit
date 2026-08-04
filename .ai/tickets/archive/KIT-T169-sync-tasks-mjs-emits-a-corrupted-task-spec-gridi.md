---
id: KIT-T169
title: sync-tasks.mjs emits a corrupted task spec (gridiron-blitz, 2026-08-02): (1) filename→ticket parsing breaks on slugs containing digits — `GB-T011-playcall-single-row-change-v23-regressed-the-2-r.md` becomes ticket "the-2"; (2) it emits tasks for non-tickets INDEX.md ("INDEX Ticket board") and _TEMPLATE.md; (3) a ticket whose Acceptance Criteria are empty contributes a bogus "## Plan" task (it scrapes past the empty checklist into the next heading); (4) ticketStatus is "todo" for every ticket even where frontmatter says doing/review (GB-T001 doing, GB-T003/T005 review per INDEX from the same frontmatter) — status parsing disagrees with index-tickets.mjs. Net effect: hydrating the native list from this spec would create ~76 tasks including garbage. Should share one frontmatter/criteria parser with index-tickets.mjs, skip _TEMPLATE/INDEX/generated files, and emit tasks only for active (doing) tickets per the hydrate contract.
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
links: [KIT-T110, KIT-T120]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes: KIT-T120
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.031Z
updated: 2026-08-04T16:42:16Z
fixed_commit: 891647e
---

## Description
sync-tasks.mjs emits a corrupted task spec (gridiron-blitz, 2026-08-02): (1) filename→ticket parsing breaks on slugs containing digits — `GB-T011-playcall-single-row-change-v23-regressed-the-2-r.md` becomes ticket "the-2"; (2) it emits tasks for non-tickets INDEX.md ("INDEX Ticket board") and _TEMPLATE.md; (3) a ticket whose Acceptance Criteria are empty contributes a bogus "## Plan" task (it scrapes past the empty checklist into the next heading); (4) ticketStatus is "todo" for every ticket even where frontmatter says doing/review (GB-T001 doing, GB-T003/T005 review per INDEX from the same frontmatter) — status parsing disagrees with index-tickets.mjs. Net effect: hydrating the native list from this spec would create ~76 tasks including garbage. Should share one frontmatter/criteria parser with index-tickets.mjs, skip _TEMPLATE/INDEX/generated files, and emit tasks only for active (doing) tickets per the hydrate contract.

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
- [2026-08-04 16:23] (status) todo → doing
- [2026-08-04 16:42] (status) doing → done
- [2026-08-04 16:42] (comment) fixed in 891647e (+ b7b249a) — id from frontmatter not filename, INDEX/_TEMPLATE/id-less files skipped, criteria read via criteria.mjs (section-scoped, empty placeholder emits no phantom '## Plan' task), status from the shared parser, only 'doing' tickets emitted. Fixture repro before/after: 15 tasks (incl. ticket 'the-2', 'INDEX Ticket board', 'SYT-T003 ## Plan') -> 3 correct tasks. KIT-T120's phantom-tasks-from-non-ticket-files symptom is covered by the 'skip: INDEX.md / _TEMPLATE.md / no-frontmatter-id contributes no task' cases. Covered by scripts/sync-tasks.test.mjs (new, 19 passed, 0 failed) + scripts/t.test.mjs (83 passed). Full npm test: 0 failed.
