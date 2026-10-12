---
id: KIT-D090
title: A dispatch may not outrank its ticket type's default job without [escalate]; opus plans, sonnet applies
status: accepted
date: 2026-10-12
supersedes:
source: KIT-T432; Chris 2026-10-12 (stiletto session, via coordinator)
---

**Decision:**
- The dispatch gate (`hooks/dispatch-escalation.mjs`, check `dispatch-escalation`) resolves the expected job from the ticket ids the prompt or description names: the ticket's `type:` maps through `.ai/config.yml` dispatch.default_job (dearest default wins when several tickets are named). A `[job: X]` whose family is costlier than that default's BLOCKS unless the prompt carries `[escalate: <reason>]`. The block names the cheaper job and the token.
- `forensic` passes without `[escalate]` only when a named ticket has type `regression`.
- With no ticket named, a read-only dispatch is held to `research` (sonnet); a writer is not held.
- Opus (design/forensic) produces the PLAN and the apply brief: file:line, the exact change, the test to add, and acceptance, written so Sonnet applies it without re-deriving anything. Implementation then dispatches on Sonnet (fix/refactor/wiring). An opus `build` is the exception and needs `[escalate: <reason>]`, e.g. novel spatial or geometry work a brief cannot pin down. The `build` row's `use:` text says so (re-dated 2026-10-12).

**Why:** Chris 2026-10-12: "Whatever is deciding what model to use seems to be overly fucking aggressive. I know sonnet can do some of the things I see being worked on." Evidence from stiletto the same day: deposit/needle diagnosis and a mine-site trace dispatched as forensic (opus), a bug fix dispatched as build (opus), where the ticket type routes to fix/research (sonnet). On the follow-up: "Here's the fucking thing, your opus buddy, can you not write prompts that are good enough for Sonnet to go fucking apply?"

Rejected: another prose reminder in CLAUDE.md (the orchestrator already holds the table and still over-picked; only a block changes the pick); pinning models in agent definitions (KIT-D080).
