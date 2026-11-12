---
id: KIT-D164
title: Agent-built work is the orchestrator's to finish; the maintainer is reached only by questionnaire
summary: Everything agents built (kit, slices, commits, handoffs, notices) is the orchestrator's to pick up; only a genuine decision reaches Chris, and only as a summary then AskUserQuestion. Never a "needs you" list, never a prose ruling.
date: 2026-11-11
supersedes: 
source: Chris 2026-11-11, messages in one turn
---


**Maintainer:** "IT'S NOT MY FUCKING COMMIT, MOTHERFUCKER. KIT IS FULLY MAINTAINED BY AGENTS, SO IT'S YOUR FUCKING COMMIT." "ARE YOU ASKING ME TO FUCKING RULE ON SOMETHING WITHOUT A MOTHERFUCKING QUESTIONNAIRE? PROCESS FUCKING FAILURE." "NONE OF THOSE FUCKING THINGS NEEDS ME AND IF THEY FUCKING DO IT BETTER BE IN THE FORM OF A FUCKING QUESTIONNAIRE." "ALL THE SHIT THAT YOU SAY NEEDS ME WAS BUILT BY FUCKING AGENTS THAT EITHER ARE OR AREN'T FUCKING RUNNING. IF YOU CAN'T TALK TO THEM, IT'S ON YOU TO PICK UP THE FUCKING PIECES AND ASK ME FUCKING QUESTIONS DINGUS."

**Decision:** Work an agent built or left open is the orchestrator's: commits, publishes, retired-worker handoffs, stale tickets, notices. The orchestrator finishes it, or re-briefs a fresh agent from the ticket Notes when the builder is gone. A closing report never carries a "Needs you" list of agent-built items; it lists only genuine maintainer acts (UAT of a user-visible landing, a credential, an external approval). Any decision that is genuinely Chris's (a design ruling, a policy amendment, a restructure a gate forces) goes through AskUserQuestion after a plain summary; "needs your call" in prose is a process failure. Reversible choices inside a fix are decided by the orchestrator and reported in one line.

**Why:** Chris 2026-11-11, quoted above; the kit's agent-built backlog was being returned to him as chores.

**Assistant-added:** How to apply: at every landing receipt, triage open handoffs and notices, finish or re-brief them, and raise only true decisions by questionnaire. A commit blocked over agent-relayed approval is committed once Chris's own words authorise it; KIT-T944's residual landed as 600117f on that authority.
