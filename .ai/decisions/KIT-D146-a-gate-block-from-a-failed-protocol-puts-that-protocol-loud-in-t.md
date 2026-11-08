---
id: KIT-D146
title: A gate block from a failed protocol puts that protocol loud in the global rules, the same turn
summary: The questionnaire-brief protocol goes verbatim into CLAUDE.global.md and /decide; every future block caused by an unfollowed protocol gets the same treatment
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** "WHY THE FUCK ARE YOU GUYS RUNNING INTO IT ALL THE FUCKING TIME AND NOT JUST USING THE FUCKING PROTOCOL?" then "PUT IT FUCKING LOUD AND FUCKING PROUD WHERE IT NEEDS TO FUCKING BE AND ANY FUTURE BLOCK ENCOUNTERS THAT RESULT FROM A FUCKING FAILED PROTOCOL NEED THE SAME FUCKING TREATMENT"

**Decision:**
1. The questionnaire protocol (KIT-D129, KIT-D142, the question-brief gate's exact sentence shapes) is written verbatim and prominently into user-config/CLAUDE.global.md (the DECISIONS section) and commands/decide.md, so every session has it before its first questionnaire.
2. Standing rule: whenever a gate blocks because a protocol was not followed, the session that hit it writes that protocol, in the exact shape the gate parses, into the global rules (or the owning command/skill) in the same turn, and records it here. A protocol that lives only in a gate's block message or a decision file is a defect.

**Why:** The question-brief protocol existed only in the gate's error text and in KIT-D142, which sessions do not load at start. Every session learned it by being blocked, repeatedly (KIT-T846, T854, T856, T865, T867, T872, T876, T881), costing turns on every questionnaire.

**Rejected:** relying on the block message to teach the protocol (every session pays the block first).

**Assistant-added:** Related KIT-D129, KIT-D142, KIT-T881. Enforcement of rule 2 (a hook that detects a repeat protocol block and checks the rules carry the protocol) is a kit-feature ticket.
