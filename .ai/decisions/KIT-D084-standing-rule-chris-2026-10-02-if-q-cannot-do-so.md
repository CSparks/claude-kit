---
id: KIT-D084
title: Standing rule (Chris 2026-10-02): if q cannot do something an agent needs (unknown query, missing filter, no answer for a search shape…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-10-06
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Standing rule (Chris 2026-10-02): if q cannot do something an agent needs (unknown query, missing filter, no answer for a search shape that then falls back to grep), that is an immediate KIT ticket AND an agent dispatched to build it — never a silent fallback. Enforced by hooks: q itself auto-captures its own capability misses; the telemetry hook (KIT-T285) captures a grep that follows a failed or empty q; orient surfaces unbuilt q-gap tickets so the main thread dispatches them.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
