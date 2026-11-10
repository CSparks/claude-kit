---
id: KIT-D154
title: Every agent triages every hook block as process failure or kit bug
summary: on any hook block each agent says in its next reply which of three it is: process failure (ticket root cause and prevention), kit bug (ticket and fix agent this turn), or known kit bug with the fix in progress (name the open ticket and its agent)
date: 2026-11-09
supersedes: 
source: conversation 2026-11-09 (Chris, groovegrid; GG-D053)
revised: 2026-11-10
---


**Maintainer:** "That is a question EVERY agent should ask anytime they encounter a hook block. If it's a process failure, hwo do we prevent it from happening agian. If it's a bug, send an agent to fix it immediately." Then: "That needs to be a global KIT principle." Then, on the third answer: "That should be a valid third response for fix being in the works."

**Decision:** Whenever an agent, the orchestrator included, meets a hook block, its next reply gives one of three answers. PROCESS FAILURE (the agent broke a rule the gate enforced): a ticket with the root cause plus a prevention that stops the recurrence (a gate, a hook message, a rule in the owning command or CLAUDE.md). KIT BUG (the gate misfired, missed, or lacked a printout): a ticket and its fix agent dispatched the same turn (KIT-D145). KNOWN KIT BUG, FIX IN PROGRESS (the same defect already has an open ticket and an agent working it): the reply names the ticket id and the agent; no new ticket and no new dispatch. The question rides in three places so no context has to remember it: the shared block-message footer every gate emits (`hooks/lib/block-triage.mjs`, appended by `excludeFooter` and `triageFooter`), the base CLAUDE.md HOOK CONTRACT section (KIT-D146 shape), and the agent brief template and definitions every dispatched agent inherits. A test enumerates the gates and fails when one omits the line or one of the three answers.

**Why:** Chris 2026-11-09 after a store-grep block: the orchestrator filed a bug without first saying which kind it was, and the same session had met an unblocked grep the gate missed. Naming the kind forces the right remedy: a missed rule by the agent needs a prevention, a gate fault needs a fixer, and neither waits for the maintainer. The third answer stops duplicate tickets and duplicate dispatches when a block recurs while its fix is already under way.

**Rejected:** a reminder in memory only (context clears, KIT-D134); asking the maintainer which kind it was (the agent can tell from the block text and its own command); a new ticket and dispatch on every recurrence of a defect already being fixed (duplicates, wasted agents).

**Assistant-added:** Extends KIT-D145 and KIT-D147; promotes GG-D053; built by KIT-T920; amended with the third answer 2026-11-09.
