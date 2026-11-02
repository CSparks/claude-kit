---
id: KIT-D130
title: Broker and agent handoffs never need the maintainer's input unless the issue is development-specific
summary: Broker/agent handoffs, resumes, successors and gates resolve on their own, crash included; the maintainer is asked only for an architectural or development decision. Chris 2026-11-02: 'The whole point of this tracking system is to make handoffs like this resolve on their own unless there's really a decision to be made architecturally, not untangling a situation that will inevitably happen again if something crashes.'
date: 2026-11-02
supersedes: 
source: conversation 2026-11-02
revised: 2026-11-02
---


**Decision:** Chris 2026-11-02, verbatim: "Broker/Agent handoff, unless there is some development specific issue, shouldn't require my input." Also 2026-11-02: "if the work isn't picking up and resuming gracefully, that's a broker issue that needs to be fixed first." Reopening hand-back agents, dispatching or excluding successors, and clearing stop-hook blocks about them are settled by the orchestrator. A hand-back that fails to resume is a kit-bug for the standing kit agent. Only a development-specific question (what the game should do or look like) goes to the maintainer.

**Why:** A successor-gate block on workers that ended normally under DE-D062 led to a questionnaire about bookkeeping, then three gate bounces.

**How to apply:** Decide handoff and gate questions myself and report in one line. Never an AskUserQuestion about broker or agent mechanics. A resume that does not happen is a kit-bug, filed and dispatched at once.
