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
