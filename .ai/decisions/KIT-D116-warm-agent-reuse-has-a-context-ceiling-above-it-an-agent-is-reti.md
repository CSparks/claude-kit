---
id: KIT-D116
title: Warm agent reuse has a context ceiling; above it an agent is retired after its current step and the next ticket goes to a fresh agent briefed from the ticket and Notes
summary: Amends KIT-D077 and KIT-D094. Ceiling default 200k tokens in one config value (.ai/config.yml dispatch.context_ceiling_tokens), the orchestrator's default, open to Chris. An agent past it is retired after a written handoff (job ids, state, next steps, file pointers) in the ticket Notes; the dispatch guard refuses a replacement until the handoff is there.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29 in the dirt-empire session (DE-D062); the 200k figure is the orchestrator's default, not Chris's words
revised: 2026-10-29
---


**Decision:**
- **Ceiling.** An agent whose context passes the ceiling (about 200k tokens, the last request's total on its roster row) is retired after its current step. The next ticket, or the resumption of a handed-back one, goes to a fresh agent briefed from the ticket and its Notes.
- **Amends KIT-D077 and KIT-D094.** KIT-D077's "the next ticket goes to the SAME agent after it lands (warm build, warm context)" and KIT-D094's "one standing kit agent, reused warm for every fix" hold only below the ceiling. Above it, warm reuse costs more per call than a fresh agent costs in total.
- **One config value.** `dispatch.context_ceiling_tokens` in the kit `.ai/config.yml` (default 200000). The figure is the orchestrator's default, open to Chris to change.
- **A retiring agent MUST write a handoff first** (Chris 2026-10-29: "Agents being retired MUST write a handoff first."). The handoff goes in the ticket Notes as a `Handoff` block with the labelled lines `Jobs:`, `State:`, `Next:` and `Files:` (job ids, state, next steps, file pointers). It never lives in a session scratchpad, which dies with the session.
- **Enforcement.**
  - The roster records each agent's context tokens (`tokens` on its row). SubagentStop, the dispatch guard and orient flag an agent past the ceiling and tell the orchestrator to request the handoff (a SendMessage carrying `[write-handoff]`).
  - `resume-check` blocks any other SendMessage to an agent past the ceiling (escape `[resume-over-ceiling: <reason>]`).
  - The dispatch guard refuses a dispatch citing a ticket whose past-ceiling agent has not left the handoff block in the ticket Notes (escape `[handoff-waived: <reason>]`).

**Why:** Chris 2026-10-29, verbatim: "One agent with half a fucking million and one with 700k. What the fuck are they doing?", "They are WASTING FUCKING TOKENS." and, on the fixes, "Context ceiling ... Agents being retired MUST write a handoff first." Every tool call re-sends the whole context, so a warm agent at 700k costs more per call than a fresh agent costs in total.

**Rejected:** unbounded warm reuse; summarising an over-ceiling agent's context in place (the same bytes are re-sent every call); a handoff kept in a session scratchpad.
