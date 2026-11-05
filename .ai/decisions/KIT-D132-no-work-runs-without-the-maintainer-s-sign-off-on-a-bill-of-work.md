---
id: KIT-D132
title: No work runs without the maintainer's sign-off on a bill of work; hooks never dispatch agents on their own
summary: Every session works from a signed bill of work; hooks never dispatch; notices are relayed; confer before any action not discussed in the current context
date: 2026-11-05
supersedes: KIT-D130
source: Chris 2026-11-05, dirt-empire session
revised: 2026-11-05
---


**Status:** accepted
**Decided by:** Chris

**Decision:** Every session starts with a bill of work: the maintainer dictates it, or signs off on an existing one. Work outside the signed bill is raised to him, never started. A retired worker's handoff, a held successor brief, a queued dispatch or a hook demand (successor-gate, handback directive, orient DISPATCH NOW) is a notice to surface, not an instruction to dispatch. Answering the maintainer's direct question comes before any of it. After a clear or resume the model has no memory of prior asks and the maintainer does not remember everything he said, so any action not discussed in the current context window is conferred with him before it is taken.

**Maintainer:** "THis sounds like a fucking MESS. THere is no fucking reason stopping at the wrong time means fire off a bunch of fucking agents. YES, if we've been talking about a body of fucking work and most fucking importantly I UNDERSTAND THE FUCKIGN CONTEXT THEN AND ONLY THEN SHOULD WORK CONTINUE. You NEVER just fucking fire off agents to blindly chew through a queue. I APPROVE ALL FUCKING WORK IN THE CURRENT CONTEXT. You can raise it to my fucking attention, but it should NEVER be automatic."
"EVERY SESSION requires that either I dictate a bill of work or I sign off on an existing bill of work."
"NEVER fucking just go off and do shit. You have no fucking idea if a ticket has been superceded by other work done in another session." "Or if it's even fucking relevant anymore."
Addendum, same day: "It is ALWAYS important to understand that we BOTH have unreliable context. I do not remember EVERYTHING I've ever said and once your context is cleared you don't either, so it's extremely wasteful and sometimes dangerous to NOT confer ANY action before doing it, ESPECIALLY if it's not something we've discussed in your current context window."

**Why:** On 2026-11-05 a hook-driven queue drain dispatched agents on four stale tickets (DE-T295, DE-T298, DE-T299, DE-T300) while the maintainer was asking direct questions. Nobody had checked whether another session had superseded those tickets or whether they were still relevant. Only the maintainer knows the current context, so only he signs off on work. Both contexts are unreliable, so conferring is cheaper than redoing or undoing.

**Rejected:** KIT-D130 ("no maintainer input needed" for successor dispatch) and the automatic queue-drain on session resume.

**Assistant-added:** Consequence for the kit: successor-gate and the handback directive stop blocking turns and stop demanding dispatches; they report open handoffs to the maintainer instead. Orient's "DISPATCH NOW" lines become "OPEN, awaiting a bill of work". Orient and the base CLAUDE.md state the bill-of-work rule and the confer-after-clear rule in every session. Implemented 2026-11-05: hooks/lib/bill-of-work.mjs, successor-gate, handback-directive, kit-bug-dispatch-gate, orient sections, auto-review, broker summary, user-config/CLAUDE.global.md, project snippets, /drain and /work.
