---
id: KIT-T196
title: request-gate re-fires on a request captured in ANOTHER repo's store, so every Stop needs a [no-capture] token
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:17Z
updated: 2026-08-06T02:29:17Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> # request-gate re-fires on a request captured in another repo's store
>
> Observed client-rx-clinical session 2026-08-05: Chris asked for a KIT feature mid-session;
> it was captured + shipped in the kit's own store (KIT-T179). The dispatching session's
> request-gate cannot see that store, so its Stop hook re-flags the same phrase on EVERY
> subsequent stop — three times in one session — and each reply must re-carry a
> `[no-capture]` token for work that IS captured.
>
> Root cause: request-capture matches against the current repo's `.ai` only; a request
> routed cross-repo (the routes_to target being another project, exactly what the kit
> scope is for) looks permanently un-captured. Same blind spot family as KIT-T177
> residual 4 / progress residual 3.
>
> Fix directions (pick at triage): satisfy the gate when the reply carries a receipt
> citing an id in ANY registered store (central store lookup via q --scope all); or
> remember flagged-phrase → token acknowledgements per session so one ack silences that
> phrase's re-fires; or both.

Provenance: `.ai/inbox/triaged/2026-08-05-1650-request-gate-cross-repo-blindness.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] a request captured in ANOTHER repo's store satisfies the gate — no [no-capture] token needed for work that is captured
- [ ] the cross-store check is bounded (no full scan of every project on every Stop)
- [ ] a test drives the lived case: request captured in repo A, Stop fires in repo B

## Plan
1.

## History
- [2026-08-06 02:29] (created) bug — request-gate re-fires on a request captured in ANOTHER repo's store, so every Stop needs a [no-capture] token
- [2026-08-06 02:30] (comment) criterion added: a request captured in ANOTHER repo's store satisfies the gate — no [no-capture] token needed for work that is captured
- [2026-08-06 02:30] (comment) criterion added: the cross-store check is bounded (no full scan of every project on every Stop)
- [2026-08-06 02:30] (comment) criterion added: a test drives the lived case: request captured in repo A, Stop fires in repo B

## Notes
- [2026-08-16 00:06] (comment) folded from triage: # request-gate re-fires on an already-captured request across turns

2026-08-08, gridiron-blitz. "Kicks SHOULD be higher arcs" was routed to GB-T119
(verbatim in the ticket, status doing) and receipted in the reply the turn it
arrived. The request-capture check fired anyway on that turn's stop, was
answered with the ticket pointer, then fired AGAIN two turns later when a later
reply merely mentioned kicks. The gate appears to scan the visible tail for
request-shaped lines without consulting the store (q fts would find the verbatim
in GB-T119 instantly) and without remembering its own acknowledged answers.
Fix idea: before warning, run the candidate line through q fts against
tickets/decisions; a hit (or a prior [no-capture]/receipt for the same line in
the session) suppresses the warning.
- [2026-08-16 00:06] (comment) folded from triage: request-gate (request-capture check) re-fires on an ALREADY-captured request across multiple Stops: the stadium-lights request was routed to GB-T073 (cap->triage->ticket, doing->review, fixed_commit e179a6a) yet the gate flagged it as un-captured on two consecutive Stop hooks, even after a reply naming the ticket. The gate appears stateless about prior-turn captures / does not match routing receipts in the reply. Fix at source: match quoted request text against inbox/triaged + ticket bodies, or honor a receipt line naming a ticket id
- [2026-08-16 00:06] (comment) folded from triage: request-gate re-fires on the SAME already-routed quote at every subsequent Stop (seen 3x in one gridiron-blitz session on the GB-T053 quote) — it should remember a quote once routed/acknowledged (e.g. hash routed quotes into session state) instead of re-matching the whole transcript each stop
