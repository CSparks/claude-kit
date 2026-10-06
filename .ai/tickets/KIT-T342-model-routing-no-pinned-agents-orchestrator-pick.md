---
id: KIT-T342
title: Model routing: no pinned agents, orchestrator picks the family from one capability table, local Qwen lane
type: feature
status: review
priority: high
milestone:
labels: []
links: [KIT-T326, KIT-T337, KIT-T339]
files: []
supersedes:
superseded_by:
created: 2026-10-06T04:57:51Z
updated: 2026-10-06T14:46:15Z
---

## Description
Chris 2026-10-05 (verbatim): "Let's not pin agents. But let's make the main coordinator agent (you) pick based on THE MOST UP TO DATE info on which model is best for which. We also have Qwen 3.8 27B on the Volta that can run 3 agents at once for triple speed."

Chris 2026-10-06 (verbatim, absorbed): "The agents need to be assigned a model based on capabilities based on current models offered. Not hard coded. I doubt the game asset artist really fucking needs fable. NOTHING should be using Opus 5 when Opus 5-5 is out."

Chris 2026-10-05 (verbatim): "Comfy is shut down. It's OK to be aware of that. We did tests and multiple agents had more throughput than one agent by itself."

Chris 2026-10-05, Qwen scope (verbatim): "Qwen is a decent coder if the change is straight forward and it's not having to be too creative or consider a large breadth of code. It's probably fine at making most targeted changes, given enough context."

Supersedes KIT-D061/D063 (binding exact version) and the pins KIT-T326 added. Related: KIT-T337 (activity tag), KIT-T339 (scheduled research refresh).

Parts: (1) no model: line in any agent, pin-only lane agents deleted, model-id lint; (2) one capability table in the kit config dispatch block with evidence dates, a 14-day freshness warning, outcome logging; (3) a 3-slot Qwen preset and a local-agent wrapper as a dispatch lane; docs.

Captures absorbed: inbox 2026-10-06-0353 and 2026-10-06-0043.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] no agents/*.md carries a model: line; sonnet55, opus55, researcher-sonnet55 are deleted and nothing references them
- [x] a model id in agents/, commands/ or skills/ fails a lint; the kit config ladder/aliases block is the only home
- [x] one capability table in .ai/config.yml dispatch: job type to family or local-qwen, cost, evidence date, source
- [x] orient warns when the table's newest evidence date is over 14 days old
- [x] roster rows record model, duration and tokens or tool calls where the payload carries them; a report script summarises per family and job type
- [x] a 3-slot qwen3.8-27b preset exists through run.ps1; its VRAM use and the apply command are stated
- [x] scripts/local-agent.mjs runs a headless local agent from a brief file into a report file, broker-aware
- [x] the Qwen lane is documented with the brief template and the escalate-after-2-failures rule

## Plan
1.

## History
- [2026-10-06 04:57] (created) feature — Model routing: no pinned agents, orchestrator picks the family from one capability table, local Qwen lane
- [2026-10-06 14:46] (comment) ticked: no agents/*.md carries a model: line; sonnet55, opus55, researcher-sonnet55 are deleted and nothing references them
- [2026-10-06 14:46] (comment) ticked: one capability table in .ai/config.yml dispatch: job type to family or local-qwen, cost, evidence date, source
- [2026-10-06 14:46] (comment) ticked: roster rows record model, duration and tokens or tool calls where the payload carries them; a report script summarises per family and job type
- [2026-10-06 14:46] (comment) ticked: scripts/local-agent.mjs runs a headless local agent from a brief file into a report file, broker-aware
- [2026-10-06 14:46] (comment) @sonnet: Landed bfd7523. Evidence: agent-pins 18 passed (no model line in any agent; model-id lint with positive control in comma (full comment #1 in ## Notes)
### comment #1 [2026-10-06 14:46] @sonnet
Landed bfd7523. Evidence: agent-pins 18 passed (no model line in any agent; model-id lint with positive control in commands/skills and negative control for family names; lane agents gone); dispatch-ladder 22 (jobs table, freshness warns at 15 days, quiet at 14); local-agent 22 (arg and prompt assembly, patch extraction, broker mode detection, 3 slots, --dry-run CLI); agent-outcome 16 (job token, response and transcript outcomes, roster rows, per-family summary); model-tag 66; activity-tag 26; dispatch-guard all PASS incl. a kit agent with no model blocked on a fable thread; plugin-compat 105. Whole chain run: only server/server.test.mjs fails (express not installed, pre-existing). Not verified live: SubagentStop payload fields come from the documented agent_transcript_path, no payload captured on disk; PostToolUse tool_response fields verified against real session transcripts (resolvedModel, totalDurationMs, totalTokens, totalToolUseCount). Qwen: V100 shows GPU is lost in nvidia-smi and llama-server is not running, so no live smoke test; preset text generated through AST-extracted run.ps1 functions. bootstrap not run (composes ~/.claude/CLAUDE.md but also unifies memory in other repos); run: node D:/dev/claude-kit/bootstrap.mjs.
- [2026-10-06 14:46] (status) todo → review
- [2026-10-06 14:46] (comment) ticked: a model id in agents/, commands/ or skills/ fails a lint; the kit config ladder/aliases block is the only home
- [2026-10-06 14:46] (comment) ticked: orient warns when the table's newest evidence date is over 14 days old
- [2026-10-06 14:46] (comment) ticked: a 3-slot qwen3.8-27b preset exists through run.ps1; its VRAM use and the apply command are stated
- [2026-10-06 14:46] (comment) ticked: the Qwen lane is documented with the brief template and the escalate-after-2-failures rule
- [2026-10-06 14:46] (status) review → review
