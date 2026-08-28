---
id: KIT-D070
title: Sessions outside a kit-managed repo (e.g. cwd = ~) get a plan-of-record home: a directory in the claude-kit-data repo for out-of-repo…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-08-28
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Sessions outside a kit-managed repo (e.g. cwd = ~) get a plan-of-record home: a directory in the claude-kit-data repo for out-of-repo discussions, so cap/flush/decisions have a store when no .ai/ exists in the cwd. Motivated by inbox 2026-08-25-0307 (H3 Volta workaround found 2026-08-22, lost until 2026-08-24). Chris, 2026-08-25.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
