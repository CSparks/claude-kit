---
id: KIT-D116
title: Warm agent reuse has a context ceiling; above it an agent is retired after its current step and the next ticket goes to a fresh agent briefed from the ticket and Notes
summary: Amends KIT-D077 and KIT-D094. Ceiling 300k tokens in one config value (.ai/config.yml dispatch.context_ceiling_tokens; raised from 200k by Chris 2026-10-30). An agent past it is retired after a written handoff (job ids, state, next steps, file pointers) in the ticket Notes; the dispatch guard refuses a replacement until the handoff is there. A retiring or near-ceiling agent's context is broken down by source, and repeated task output is flagged as garbage input and collapsed at the source.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29 in the dirt-empire session (DE-D062); ceiling raised to 300k by Chris 2026-10-30
revised: 2026-10-30
---


**Decision:**
- **Ceiling.** An agent whose context passes the ceiling (300k tokens, the last request's total on its roster row) is retired after its current step. The next ticket, or the resumption of a handed-back one, goes to a fresh agent briefed from the ticket and its Notes.
- **Amends KIT-D077 and KIT-D094.** KIT-D077's "the next ticket goes to the SAME agent after it lands (warm build, warm context)" and KIT-D094's "one standing kit agent, reused warm for every fix" hold only below the ceiling. Above it, warm reuse costs more per call than a fresh agent costs in total.
- **One config value.** `dispatch.context_ceiling_tokens` in the kit `.ai/config.yml`. Chris 2026-10-30: "Probably should push that context window limit up to 300k". Docs and tests read the value from the config, never a literal.
- **A retiring agent MUST write a handoff first** (Chris 2026-10-29: "Agents being retired MUST write a handoff first."). The handoff goes in the ticket Notes as a `Handoff` block with the labelled lines `Jobs:`, `State:`, `Next:` and `Files:` (job ids, state, next steps, file pointers). It never lives in a session scratchpad, which dies with the session.
- **Enforcement.**
  - The roster records each agent's context tokens (`tokens` on its row). SubagentStop, the dispatch guard and orient flag an agent past the ceiling and tell the orchestrator to request the handoff (a SendMessage carrying `[write-handoff]`).
  - `resume-check` blocks any other SendMessage to an agent past the ceiling (escape `[resume-over-ceiling: <reason>]`).
  - The dispatch guard refuses a dispatch citing a ticket whose past-ceiling agent has not left the handoff block in the ticket Notes (escape `[handoff-waived: <reason>]`).
- **What the context is made of (Chris 2026-10-30: "And anytime one of them gets close, I want to know if it's mostly garbage input.").** The ceiling flag ends with a composition line from the agent's transcript (`hooks/lib/context-breakdown.mjs`): shares by source (brief, agent reasoning and text, whole-file reads, ranged reads, re-reads, build/test logs, broker output, q results, bash dumps, repeated task output), the five biggest single tool results with sizes, and "MOSTLY GARBAGE INPUT" with the fix when bulk tool output is the majority. Relayed as "agent X at 280k: 62% build/test logs, 18% file reads, top: ...".
- **Garbage input is repeated task output (Chris 2026-10-30: "Like repetitive output from a running task." / "Because that needs to be managed better.").** The same or near-same line repeated (cargo "Compiling" walls, broker wait "queued"/"running" ticks, test-listing noise, progress ticks) counts as its own category and is fixed at the source:
  - The broker commands agents run print a compact summary (verdict, failed tests with their panic line, DRIVE/summary lines, the log path), never raw cargo or test logs or repeated progress lines (`scripts/broker/command-summary.mjs`, used by `report.mjs`).
  - `scripts/broker/result-summary.mjs <job>` prints exactly that; the patch-worker skill tells agents to use it instead of reading logs whole.
  - Every place the kit prints child-process output collapses repeats ("Compiling ×412", "queued at position 3 (repeated 40×)"; `scripts/broker/collapse-repeats.mjs`). A line that reports a failure (error, panic, FAILED, assertion) is never collapsed.

**Why:** Chris 2026-10-29, verbatim: "One agent with half a fucking million and one with 700k. What the fuck are they doing?", "They are WASTING FUCKING TOKENS." and, on the fixes, "Context ceiling ... Agents being retired MUST write a handoff first." Every tool call re-sends the whole context, so a warm agent at 700k costs more per call than a fresh agent costs in total.

**Rejected:** unbounded warm reuse; summarising an over-ceiling agent's context in place (the same bytes are re-sent every call); a handoff kept in a session scratchpad; reading raw build logs to find a failure.
