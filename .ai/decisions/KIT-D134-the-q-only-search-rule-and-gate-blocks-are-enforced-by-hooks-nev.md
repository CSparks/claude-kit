---
id: KIT-D134
title: The q-only search rule and gate blocks are enforced by hooks, never by agent judgment or promises
summary: Grep/rg anywhere in Bash and any end-around of a gate block must be refused by a hook; agent promises do not count because context clears
date: 2026-11-06
supersedes: 
source: Chris 2026-11-06, stiletto-2349 session
---


**Status:** accepted
**Decided by:** Chris

**Decision:** Search goes through `q`, and a gate block stands. Both are enforced by hooks that refuse the violation, including single-file and piped grep and any follow-up that pursues a blocked goal another way. An agent's promise to behave is worth nothing because its context clears.

**Maintainer:** "YOU CONSISTENTLY fucking end-around even though you get that fucking block."
"Your word means fuck all to me. Your context clears frequently."
"This has to be enforced."

**Why:** On 2026-11-06 an agent was blocked for a store grep, then ran `q show | grep -c` next; single-file greps on source were never blocked. A similar subagent end-around is KIT-T592 (2026-10-20), so the failure repeats.

**How to apply:** Build KIT-T871 (block every grep/rg in Bash; same-turn end-around detector) inside a bill Chris signs. Until then, an agent that is blocked does exactly what the block says and stops if the block looks wrong.

**Rejected:** Relying on agent judgment, memory notes or promises.
