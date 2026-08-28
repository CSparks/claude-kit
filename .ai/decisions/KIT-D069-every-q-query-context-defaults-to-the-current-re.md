---
id: KIT-D069
title: Every q query context defaults to the CURRENT repo's scope — cross-project requires 'all' or an explicit scope. Chris (2026-08-20,…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-08-28
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Every q query context defaults to the CURRENT repo's scope — cross-project requires 'all' or an explicit scope. Chris (2026-08-20, verbatim): 'The context pretty much needs to be set by default to the current repo in every query context. You should have to either reference all projects or a specific project, if querying outside of the current repo.' Generalizes KIT-T174 (fts) to every scoped verb; implementation ticket KIT-T255.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
