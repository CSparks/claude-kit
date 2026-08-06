---
id: KIT-T185
title: t new <type> files a non-board type (decision/question/note) as a TICKET instead of refusing
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T183]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:02:29Z
updated: 2026-08-06T02:14:30Z
---

## Description
`t new decision "…"` (gridiron-blitz, 2026-08-05) minted a TICKET id and wrote
`.ai/tickets/GB-T045-….md` with `type: decision`. The item then sat on the board under a T id
while `.ai/decisions/` never heard of it and the D counter kept its old max — the create path
broke the store split the taxonomy exists to enforce.

Root cause: `scaffoldNew` validated the type against the FULL `classifications` list, while
`readConfig` already computes `ticketTypes` — the subset whose `routes_to` is the board
(tickets/backlog) — for exactly this reason. The web create endpoint used `ticketTypes`; the CLI
did not, so the two disagreed about what a ticket is.

Captured together with the `q next-id GB decision` half of the same inbox item, which is fixed
separately as KIT-T183.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] t new <type> refuses a classification routed to another store, exit 1, no file written
- [x] the refusal names the route and lists the real ticket types, and points at cap <type>
- [x] an unknown type keeps its own distinct error message
- [x] readConfig exposes each classification's routes_to
- [x] scripts/t.test.mjs covers the refusals

## Plan
1. Validate `t new` against `ticketTypes`; keep the unknown-type error distinct from the
   misrouted-type one.
2. Record each classification's `routes_to` in readConfig so the refusal can name the
   destination and the `cap <type>` path that reaches it.
3. Regression tests in scripts/t.test.mjs.

## History
- [2026-08-06 02:02] (created) bug — t new <type> files a non-board type (decision/question/note) as a TICKET instead of refusing
- [2026-08-06 02:14] (comment) criterion added: t new <type> refuses a classification routed to another store, exit 1, no file written
- [2026-08-06 02:14] (comment) criterion added: the refusal names the route and lists the real ticket types, and points at cap <type>
- [2026-08-06 02:14] (comment) criterion added: an unknown type keeps its own distinct error message
- [2026-08-06 02:14] (comment) criterion added: readConfig exposes each classification's routes_to
- [2026-08-06 02:14] (comment) criterion added: scripts/t.test.mjs covers the refusals
- [2026-08-06 02:14] (comment) ticked: t new <type> refuses a classification routed to another store, exit 1, no file written
- [2026-08-06 02:14] (comment) ticked: the refusal names the route and lists the real ticket types, and points at cap <type>
- [2026-08-06 02:14] (comment) ticked: an unknown type keeps its own distinct error message
- [2026-08-06 02:14] (comment) ticked: readConfig exposes each classification's routes_to
- [2026-08-06 02:14] (comment) ticked: scripts/t.test.mjs covers the refusals
- [2026-08-06 02:14] (status) todo → review
- [2026-08-06 02:14] (comment) fixed: scaffoldNew validates against ticketTypes; readConfig records routes. Evidence: scripts/t.test.mjs 87 passed, 0 failed (4 new); server 29 pass; triage 14 pass.
