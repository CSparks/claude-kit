---
id: KIT-D103
title: "Cross-checkout rapid-game (Chris 2026-10-17, verbatim): 'Rapid game edits should not be blocked unless they are in the same repo. This…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-10-21
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** "Cross-checkout rapid-game (Chris 2026-10-17, verbatim): 'Rapid game edits should not be blocked unless they are in the same repo. This means rapid game edits and dirt empire should not affect rapid game edits in stiletto.' 'The git pin handles any conflicts there.' 'The only issue is just making sure that neither orphans commits from the other.' No coordination between checkouts; the invariant is no orphaned commit (no force push, both racers' commits reachable from origin/main, pins only name pushed shas, no reattach that drops detached-only commits). Folded into KIT-D097, enforced by KIT-T553 tests."

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
