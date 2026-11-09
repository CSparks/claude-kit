---
id: KIT-D154
title: Every agent triages every hook block as process failure or kit bug
summary: on any hook block each agent says in its next reply whether it was a process failure or a kit bug; a process failure gets a recurrence-proof prevention, a kit bug gets a fix agent the same turn
date: 2026-11-09
supersedes: 
source: conversation 2026-11-09 (Chris, groovegrid; GG-D053)
---


**Maintainer:** "That is a question EVERY agent should ask anytime they encounter a hook block. If it's a process failure, hwo do we prevent it from happening agian. If it's a bug, send an agent to fix it immediately." Then: "That needs to be a global KIT principle."

**Decision:** Whenever an agent, the orchestrator included, meets a hook block, its next reply says which kind it was. PROCESS FAILURE (the agent broke a rule the gate enforced): a ticket with the root cause plus a prevention that stops the recurrence (a gate, a hook message, a rule in the owning command or CLAUDE.md). KIT BUG (the gate misfired, missed, or lacked a printout): a ticket and its fix agent dispatched the same turn (KIT-D145). The question rides in three places so no context has to remember it: the shared block-message footer every gate emits (`hooks/lib/block-triage.mjs`, appended by `excludeFooter` and `triageFooter`), the base CLAUDE.md HOOK CONTRACT section (KIT-D146 shape), and the agent brief template and definitions every dispatched agent inherits. A test enumerates the gates and fails when one omits the line.

**Why:** Chris 2026-11-09 after a store-grep block: the orchestrator filed a bug without first saying which kind it was, and the same session had met an unblocked grep the gate missed. Naming the kind forces the right remedy: a missed rule by the agent needs a prevention, a gate fault needs a fixer, and neither waits for the maintainer.

**Rejected:** a reminder in memory only (context clears, KIT-D134); asking the maintainer which kind it was (the agent can tell from the block text and its own command).

**Assistant-added:** Extends KIT-D145 and KIT-D147; promotes GG-D053; built by KIT-T920.
