---
id: KIT-D082
title: STANDING RULE (Chris 2026-09-04): an agent NEVER end-arounds claude-kit tooling. When code-graph or q fails, answers wrongly, or is…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-10-06
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** STANDING RULE (Chris 2026-09-04): an agent NEVER end-arounds claude-kit tooling. When code-graph or q fails, answers wrongly, or is redirected to by a gate for a question it structurally cannot answer, the agent HARD STOPS and files the failure — falling back to grep/find is how the tool stays broken. A tool that does not work gets FIXED or RETIRED; there is no third state where it stays half-broken and everyone routes around it.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
