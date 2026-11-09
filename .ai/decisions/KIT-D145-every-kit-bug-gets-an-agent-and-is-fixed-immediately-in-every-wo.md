---
id: KIT-D145
title: Every kit bug gets an agent and is fixed immediately, in every workspace
summary: on any kit misbehaviour the session files the ticket and dispatches the kit fix agent the same turn; no bill of work, no raising it first
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris, stiletto-2349)
---


**Maintainer:** "ALL KIT BUGS GET AN AGENT AND GET FIXED _IMMEDIATELY_" and "EVERY FUCKING WORKSPACE SHOULD BE OBSERVING THAT."

**Decision:** A kit misbehaviour (hook, gate, q, cap, t, broker, orient) is ticketed and the kit fix agent is dispatched in the same turn, in every project. Partly supersedes the global CLAUDE.md kit-bugs clause that the fix agent is "dispatched only inside a bill of work the maintainer signs" and that kit bugs are raised to him in one line; the orient wording "awaiting a bill of work" for open kit tickets changes to match. The rest of the bill-of-work rule is untouched.

**Why:** the 2026-11-08 dispatch-guard misfire cost five blocked calls; waiting for a bill adds a turn per bug. Matches the standing memory "Kit problems go to an agent".

**Rejected:** raising kit bugs and waiting for a bill (the old rule; it delays every fix by a turn and made Chris repeat the order).

**Assistant-added:** Related KIT-T885, KIT-T886, KIT-T893, KIT-T865.
