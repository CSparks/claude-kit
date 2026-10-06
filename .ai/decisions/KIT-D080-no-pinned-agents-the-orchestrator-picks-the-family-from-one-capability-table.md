---
id: KIT-D080
title: No pinned agents; the orchestrator picks the family from one capability table
summary: agent definitions carry no model line; dispatches name a family (newest model); one dated capability table routes jobs, with a local Qwen lane first for targeted changes.
date: 2026-10-05
supersedes: KIT-D061, KIT-D063 (binding exact-version rule); the pins KIT-T326 added; KIT-D079 in part (the model-pinned lane agents)
source: conversation 2026-10-05 (Chris directive, stiletto session); inbox 2026-10-06-0353 and 2026-10-06-0043; KIT-T342
---

**Decision:**
- Agent definitions carry NO `model:` line. The orchestrator chooses the model on every dispatch.
- A dispatch names a FAMILY only (sonnet, opus, haiku, fable), which resolves to that family's newest model. No exact-version exception: a request for an older version gets a plain "can't target that" and nothing runs silently.
- The choice comes from one kit capability table (`.ai/config.yml` dispatch block): job type to family or `local-qwen`, each row with cost, evidence date and source. Inputs: the scheduled research refresh (KIT-T339) and our own dispatch outcomes. Model ids live only in the config's aliases block; a model id in agents/, commands/ or skills/ fails a lint.
- Fable is for orchestration and explicit-only work. Asset authoring is not fable.
- Local Qwen 3.8 27B (router `http://127.0.0.1:8080/v1`, id `qwen3.8-27b`, V100, 3 concurrent agents) is a dispatch lane. A targeted change both Qwen and Sonnet could do goes to Qwen first, the brief supplying files, line ranges and acceptance. After 2 failures on the same ticket it escalates to Sonnet.

**Why:** Chris 2026-10-05: "Let's not pin agents. But let's make the main coordinator agent (you) pick based on THE MOST UP TO DATE info on which model is best for which. We also have Qwen 3.8 27B on the Volta that can run 3 agents at once for triple speed." Chris 2026-10-06: "NOTHING should be using Opus 5 when Opus 5-5 is out." and "I doubt the game asset artist really fucking needs fable." On Qwen: "Qwen is a decent coder if the change is straight forward and it's not having to be too creative or consider a large breadth of code. It's probably fine at making most targeted changes, given enough context." And on throughput: "We did tests and multiple agents had more throughput than one agent by itself." Rejected: pinning exact versions in agent files (goes stale, KIT-T221); a binding-version exception (reopens the staleness).
