---
id: KIT-D123
title: A session whose kit tickets are held by another session's live kit agent hands them over and keeps no kit agent of its own
summary: KIT-D094 carve-out, assistant-proposed and pending maintainer confirmation. When another session's kit agent holds the claude-kit checkout, a session leaves its kit tickets with that agent (or messages it) and dispatches none. A ticket `doing` and touched within 4 hours counts as claimed by a live agent; a stale claim does not.
date: 2026-10-31
supersedes: 
source: assistant-proposed 2026-10-31 (kit agent, KIT-T768), pending confirmation
---


**Decision:** Proposed by the assistant, pending maintainer confirmation. KIT-D094 keeps one standing kit agent per session. Carve-out: while another session's kit agent holds the claude-kit checkout, a session does not dispatch its own writer there (KIT-D077, two writers in one checkout). It hands its kit tickets to the holder: it files the ticket, then a SendMessage to the holder or the coordinator's relay names the id. The holder claims a ticket by setting it `doing` (`t status <id> doing`) and keeps the claim alive by touching the ticket (notes, ticks, status). The kit-bug-dispatch Stop gate treats a `doing` ticket touched within 4 hours as dispatched; an older one reads as a dead agent's claim and blocks again.

**Source:** the assistant proposed this rule while fixing KIT-T768. The maintainer has not stated or confirmed it.

**Why:** dirt-empire-83 was blocked at Stop on KIT-T767, which infra-09's live kit agent already owned. Dispatching a second writer would break KIT-D077; staying blocked wastes the session.

**Rejected:**
- A session dispatches its own kit agent anyway: two writers in one checkout.
- Counting every `doing` ticket as claimed forever: a dead agent's ticket would never surface again.
