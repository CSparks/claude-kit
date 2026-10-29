---
id: KIT-D115
title: An agent may make one blocking broker wait under 5 minutes; it never polls, loops, backgrounds a wait or re-runs a job to read it, and otherwise writes a handoff and ends so the orchestrator resumes it
summary: One bounded broker wait (under 5 minutes, KIT-D104) costs nothing while blocked and is allowed. Polling, tail/sleep loops, background waits and re-running a job to read its status are banned and gated; past the one wait the agent writes a handoff and ends. Promotes DE-D062.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29 in the dirt-empire session (DE-D062); verbatim below
revised: 2026-10-29
---


**Decision:**
- **One bounded wait is allowed.** An agent may block once, in the foreground, on `wait.mjs <id>` with a timeout under 5 minutes (KIT-D104's ceiling). A wait costs nothing while it blocks.
- **Banned:** polling; `tail`, `sleep` or `while/until` loops on the broker; any wait in the background or in a background shell; a second wait on the same job; re-submitting a job unchanged to read its status; a Bash timeout over 300000 ms.
- **Past the one wait: handoff and end.** The agent submits, records the job ids and its pass/fail/stale plan in the ticket Notes, ends with no background task running, and the orchestrator resumes it.
- **Resume signal.** The broker records the submitting agent, session and ticket on each job and writes one line per finished job (job id, verdict, agent id, ticket) to `target/broker/finished.log`, which the orchestrator watches with one Monitor.
- **Enforcement (four layers).**
  - `broker-wait-gate` (PreToolUse Bash|PowerShell, subagents only) denies the banned shapes; each has a negative control in its test.
  - `broker-agent-tag` adds `--agent <id>` to a subagent's `submit.mjs`/`wait.mjs` call; `wait.mjs` refuses `--timeout` over 300 s and `watch.mjs` refuses outright when the caller is a subagent, so the command refuses even where a pattern is dodged.
  - SubagentStop ends the shell trees of an agent that ends with live background children, broker waits included, and reports it.
  - `activity-tag` appends the rule to every patch-worker brief; orient and the dispatch guard flag an agent past the context ceiling (KIT-D116).

**Why:** Chris 2026-10-29, verbatim:
- "You have a fucking agent that's been awaiting the broker for 1 fucking hour. What the fuck is up?"
- "And one that's been grepping for an hour." (A `submit.mjs` wait piped through `grep -v "queued at position\|running"`.)
- "You should not be running fucking agents if they spend all their fucking time waiting."
- "They should fucking wrap and you should reopen them when they can work."
- "there should be NO FUCKING SCENARIO WHERE A FUCKING AGENT IS SPENDING MORE THAN 5 FUCKING MINUTES WAITING. THEY SHOULD WRITE A FUCKING HANDOFF AND RESUME."
- On the broker and agent fixes, 2026-10-29: "Compile check off-queue, Context ceiling, Ban polling, allow a single wait, Measurement lane, Agents being retired MUST write a handoff first."

**Rejected:** a ban on every wait (a single bounded wait costs nothing while blocked); piping the wait through a filter; a background-shell wait (the agent stays alive on it); a polite instruction in the skill alone.
