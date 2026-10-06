---
id: KIT-D086
title: Session scope (Chris 2026-10-02): a session started in a repo is about that repo plus its submodules (stiletto = stiletto + rapid-game)…
summary:           # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
date: 2026-10-06
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** Session scope (Chris 2026-10-02): a session started in a repo is about that repo plus its submodules (stiletto = stiletto + rapid-game) unless the maintainer names another target; kit work only when named (as kit bugs are, by the standing kit-bug rule). Searches, captures and the request check default to that scope; a capture into an explicitly named store counts as routed (KIT-T288).

Exception (Chris 2026-10-02): claude-kit is everyone's business — from ANY session, kit bugs and needed kit features are logged straight to KIT tickets and an agent is dispatched in the claude-kit checkout immediately, unless the maintainer directs otherwise. The kit store therefore always counts as an in-scope capture target.

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
