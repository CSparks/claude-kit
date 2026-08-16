---
id: KIT-D062
title: Interjection routing runs a project reality-check — domain mismatch means ASK, never infer
summary: Routing runs a project reality-check first: a domain mismatch means ASK which project, never infer and spend.
date: 2026-08-06
supersedes:
source: conversation 2026-08-06 (Chris, verbatim, after the stadium-lighting misroute)
---

**Decision:** Before routing any interjection — and always before an expensive dispatch on an
inferred target — the router checks that the content actually fits the active project's domain.
Signals that it does not: a noun the project's world cannot contain; another adopted project's
domain vocabulary; matching in-flight work in another project's store (`q fts`). On any signal,
STOP and confirm the target project in one line. A receipt stating the assumption is not
sufficient — the confirmation must precede the spend. Contract landed in kit CLAUDE.md +
project-template/CLAUDE.snippet.md (routing step 2); mechanical enforcement is KIT-T213
(per-project `domain:` vocabulary in `.ai/config.yml` + a router/hook check + a cross-store
pre-dispatch probe).

**Why:** Chris, verbatim: "Claude Kit needs to enforce a reality check to determine if it sounds
like I'm talking about another fucking project. I have five fucking consoles open and the wires
get crossed and a fucking smart person would say 'This is an asteroid mining game. There's no
fucking stadium.'" The failure it codifies: "Add stadium lighting and shadows" arrived mid-turn
in a kit session that had been working stiletto (asteroid mining) all day; the router matched
on session context, noted the ambiguity in a receipt, and spent a fable-tier dispatch building a
four-tower stadium ring around an asteroid basecamp — while the real target (gridiron-blitz, a
football game) already had another session on the job. The receipt was read only after the spend.
Cost of the question: one line. Cost of the guess: the dispatch, a revert that broke a live
checkout, and an hour of untangling.

Rejected: relying on routing receipts alone (proven insufficient — they surface the assumption
after the money is spent); keyword-blocking without confirmation (a hard block on fuzzy semantic
signals would misfire; the enforcement is stop-and-ASK, not stop-and-refuse).
