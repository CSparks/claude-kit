---
id: KIT-T194
title: supersede links are asymmetric: six tickets carry superseded_by with no reciprocal supersedes, so the indexer's two counts disagree
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:16Z
updated: 2026-08-06T02:29:16Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (bug) Supersede links are asymmetric in the KIT store: 6 tickets carry `superseded_by`
> with no reciprocal `supersedes` on the newer ticket, so index-tickets' summary reads
> "9 superseded ... 3 chain(s)" — both numbers now same-scope (post KIT-T125) but they
> count different sets. reconcile-supersede only writes reciprocals between two ACTIVE
> tickets. Fix direction: reconcile (or the indexer) should treat `superseded_by` on any
> ticket as authoritative and either backfill the reciprocal or count chains from the
> union. Found by the wave-3 agent 2026-08-04 while closing KIT-T125/T154. --priority medium

Provenance: `.ai/inbox/triaged/2026-08-04-1935-superseded-reciprocal-asymmetry-counts-diverge.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] the two supersede numbers in the index summary count the same set, or each says what it counts
- [ ] a superseded_by pointer is authoritative: the reciprocal supersedes is backfilled (or the chain count reads the union)
- [ ] the six existing asymmetric KIT tickets reconcile without hand-editing

## Plan
1.

## History
- [2026-08-06 02:29] (created) bug — supersede links are asymmetric: six tickets carry superseded_by with no reciprocal supersedes, so the indexer's two counts disagree
- [2026-08-06 02:30] (comment) criterion added: the two supersede numbers in the index summary count the same set, or each says what it counts
- [2026-08-06 02:30] (comment) criterion added: a superseded_by pointer is authoritative: the reciprocal supersedes is backfilled (or the chain count reads the union)
- [2026-08-06 02:30] (comment) criterion added: the six existing asymmetric KIT tickets reconcile without hand-editing
