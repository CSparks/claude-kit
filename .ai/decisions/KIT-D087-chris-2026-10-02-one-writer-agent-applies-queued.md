---
id: KIT-D087
title: Chris 2026-10-02: ONE writer agent applies queued patches, builds, runs tests and lands on main in the one checkout; every other agent is…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-10-06
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Chris 2026-10-02: ONE writer agent applies queued patches, builds, runs tests and lands on main in the one checkout; every other agent is read-only and queues patches plus the tests that prove them, getting results back to revise. Reuses scripts/broker queue/results; no worktrees or lane branches. Refines KIT-D074, resolves KIT-T276.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
