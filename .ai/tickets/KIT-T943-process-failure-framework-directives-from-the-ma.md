---
id: KIT-T943
title: Process failure: framework directives from the maintainer rot unbuilt. (1) RG inbox 2026-10-28 framework policy (Chris: 'push toward batchin
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:24:59Z
updated: 2026-11-10T18:08:40Z
---

## Description
Process failure: framework directives from the maintainer rot unbuilt. (1) RG inbox 2026-10-28 framework policy (Chris: 'push toward batching and reusing... And caching') was never triaged into a rapid-game CHOICES row, decision or ticket. (2) DE-D077 (2026-11-02, foliage/rocks are framework crates shared with Stiletto) was recorded in the dirt-empire store, listed by orient as UNPROMOTED (KIT-D111) every session since, and its ticket DE-T285 sat todo; no framework session ever saw it. 2026-11-10 Chris: 'I've discussed this before somewhere, so I'm a little fucking pissed off that there isn't a solution built for this at the framework level already.' Root cause: a framework-scope decision captured in a game store or framework inbox has no forced path into the framework's own store and roadmap; orient only lists it. Needed: promotion is enforced, not listed: a framework-scope decision is mirrored into the framework store as an open ticket the same turn, and a framework inbox item older than N days that carries a maintainer directive blocks the framework session's Stop until triaged.

kit-bug-shape: cap:bug:process-failure-framework-directives-from-the-ma
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 58e5b68, eb7fa11; tests: scripts/framework-mirror.test.mjs, hooks/framework-directive-stop.test.mjs (negative controls included); standing kit agent adcd3ffd
Thresholds recorded: a framework-inbox directive blocks every Stop at 3+ days old (q confirmations threshold CONFIRMATION_DAYS = 3); a mirror needs the project to consume rapid-game (frameworks/rapid-game.md detection) and a title or summary naming rapid-game, framework, shared crate or rg-*. Backfilled: DE-D077 -> RG-T337, the 2026-10-28 batching/caching inbox note -> RG-T338. Four more directives 10-20 days old rest in the rapid-game inbox and will block framework Stops until triaged.

## History
- [2026-11-10 17:25] (created) bug — Process failure: framework directives from the maintainer rot unbuilt. (1) RG inbox 2026-10-28 framework policy (Chris: 'push toward batchin
- [2026-11-10 18:03] (landed) 58e5b68 framework directives are built, not listed: t decide mirrors a framework-scope decision recorded in a game store into th
- [2026-11-10 18:07] (landed) eb7fa11 framework mirror finds the framework store by its id key and the registry's store directory (central data root included)
- [2026-11-10 18:08] (status) todo → review
- [2026-11-10 18:16] (landed) ec0c0e1 framework mirror: only a project that consumes rapid-game mirrors a framework-titled decision (a web UI framework decisi
