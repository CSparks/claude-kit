---
id: KIT-D065
title: Docs-folder rule (Chris, stiletto 2026-08-06): anything written to a document folder OUTSIDE the kit/.ai structure (docs/ in any repo)…
date: 2026-08-16
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Docs-folder rule (Chris, stiletto 2026-08-06): anything written to a document folder OUTSIDE the kit/.ai structure (docs/ in any repo) must be standalone - written as if the reader knows nothing about other projects or who the maintainer is. No cross-project names (HOD, marble-madness), no personal attribution, no .ai ticket/decision ids, no session dates. Provenance and history live in the .ai store; repo docs are timeless doctrine/reference. Candidate enforcement: a docs-gate hook flagging id patterns (<KEY>-[TDQN]###) and known project names in docs/** commits.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
