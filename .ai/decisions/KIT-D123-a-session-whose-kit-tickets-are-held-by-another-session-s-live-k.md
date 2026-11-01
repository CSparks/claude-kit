---
id: KIT-D123
title: A session whose kit tickets are held by another session's live kit agent hands them over and keeps no kit agent of its own
summary: KIT-D094 carve-out, confirmed by the maintainer. When another session's kit agent holds the claude-kit checkout, a session hands its kit tickets to that agent and dispatches none. A ticket `doing` and touched within 4 hours counts as claimed by a live agent; a stale claim does not.
date: 2026-10-31
supersedes: 
source: Chris 2026-10-31, infra session, AskUserQuestion answer on KIT-T768
revised: 2026-11-01
---


**Decision:** KIT-D094 keeps one standing kit agent per session, with this carve-out: while another session's kit agent holds the claude-kit checkout, a session does not dispatch its own writer there (KIT-D077, one writer per checkout). It hands its kit tickets to the holder: it files the ticket, then a SendMessage to the holder or the coordinator's session names the id. The holder claims a ticket by setting it `doing` (`t status <id> doing`) and keeps the claim alive by touching the ticket (notes, ticks, status). The kit-bug-dispatch Stop gate treats a `doing` ticket touched within 4 hours as dispatched; an older one reads as a dead agent's claim and blocks again.

**Maintainer:** Chris, 2026-10-31. Asked "When another session's kit agent already holds claude-kit, what should a session do with its kit tickets?", he chose "(Recommended) Hand to holder" over "Wait, then own".

**Why:** dirt-empire-83 was blocked at Stop on KIT-T767, which infra-09's live kit agent already owned. Dispatching a second writer would break KIT-D077; staying blocked wastes the session.

**Rejected:**
- A session dispatches its own kit agent anyway: two writers in one checkout.
- Wait for the checkout to free, then dispatch its own agent: the maintainer chose the hand-off.
- Counting every `doing` ticket as claimed forever: a dead agent's ticket would never surface again.
