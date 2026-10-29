---
id: KIT-D112
title: Agent orchestration runs on the subscription only: no kit or project tooling uses an API key, an SDK or an HTTP model call
summary: Promotes ST-D202 kit-wide on Chris's answer. The broker, hooks, scripts, agents and every project's tooling use Claude Code subagents or the claude CLI under the subscription login; an API key, the Anthropic SDK or an HTTP call to a model endpoint is not used anywhere. A kit test fails the build on one.
date: 2026-10-29
supersedes: 
source: ST-D202 (Chris 2026-09-30, Stiletto); Chris 2026-10-29 on the promotion question, answering "(Recommended) Yes, kit-wide.
---


**Decision:** (promotes ST-D202; Chris 2026-10-29: "(Recommended) Yes, kit-wide.")
- Agent orchestration is strictly subscription-only: Claude Code subagents, or the claude CLI under the subscription login.
- No naked API calls anywhere in the kit or in any project's tooling, broker, hooks, scripts, agents or workers: no Anthropic SDK, no HTTP call to a model or models endpoint, no ANTHROPIC_API_KEY read from the environment.
- Cost is measured as subscription usage, not API dollars.
- The kit enforces it with scripts/no-api-calls.test.mjs, which fails when a tracked kit source file names an API key, the SDK or the API host. scripts/model-refresh.mjs no longer has an API-key path: it reads the public docs page.
- A project that wants an exception asks the maintainer; the answer is a superseding decision.

**Why:** Chris, ST-D202 2026-09-30: orchestration is "STRICTLY subscription-only ... NO naked API calls: no Anthropic SDK or HTTP calls, no ANTHROPIC_API_KEY, anywhere in the orchestrator, broker or workers." The cost model the whole dispatch ladder (KIT-D080) rests on is subscription usage.

**Rejected:** per-project exceptions for model-listing or batch work; an API-key path kept behind an environment variable.
