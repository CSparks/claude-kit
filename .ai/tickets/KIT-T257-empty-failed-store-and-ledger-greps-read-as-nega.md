---
id: KIT-T257
title: empty/failed store-and-ledger greps read as negative facts: a grep for the CHOICES.toml noise row matched nothing (wrong pattern for the…
summary:               # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
type: bug
status: todo
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
created: 2026-08-28T22:01:31.160Z
updated: 2026-08-28T22:01:31.160Z
---

## Description
empty/failed store-and-ledger greps read as negative facts: a grep for the CHOICES.toml noise row matched nothing (wrong pattern for the [[choice]] schema) and Claude proceeded to relitigate the day-old fastnoise-lite row from training knowledge instead of reading the ledger. Root cause: a query that returns nothing is treated as 'checked, absent' with no receipt. Wanted: ground-before-claim enforcement for CHOICES.toml/ledger mentions — naming a crate alternative in output requires citing the row (or 'not checked'), same shape as KIT-T214 state-claim receipts.

Chris 2026-08-21, escalating (verbatim): "if you're having to grep for shit that should
be cached in a database with a full text index, that's a big fucking process failure."
Concrete fix, two parts: (1) register CHOICES.toml as an INDEXED STORE in q — row-level
FTS (concern/crate/why/rejected/decided), so `q fts fastnoise` surfaces the ledger row
itself, not just tickets that mention it; generalize to other registered non-.ai truth
files (docs/CRATES.md, research KB). (2) extend the query-gate to cover ledger paths —
a grep against CHOICES.toml gets blocked and routed to q exactly like a .ai store grep.
Note: q's existing index ALREADY surfaced ST-T325's title on `fts fastnoise` — the miss
was grepping instead of querying; gate coverage is what makes the right tool the only
tool.

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
