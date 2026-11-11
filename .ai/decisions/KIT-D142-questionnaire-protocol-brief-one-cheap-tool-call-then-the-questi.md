---
id: KIT-D142
title: Questionnaire protocol - brief, one cheap tool call, then the questionnaire in a new reply
summary: A brief in the same reply as AskUserQuestion is unreadable at PreToolUse; the sender writes the brief, makes one cheap tool call, then sends the questionnaire in the next reply
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** answered the questionnaire "How do we handle the same-reply brief the gate cannot read on the first call (KIT-T881)?" with "(Recommended) Brief, one cheap call, then questionnaire".

**Decision:** The question-brief gate (KIT-T846) stays a block. To pass it, an orchestrator writes the full brief as a message, makes one cheap tool call, then sends AskUserQuestion in the next reply. The gate is not loosened: no warning mode, no input-only judging.

**Why:** At PreToolUse the call's own reply is not yet on disk (KIT-T881 diagnosis, commits 5dc5ef8 and 7210d3a), so a same-reply brief is unreadable on the first call.

**Rejected:** warning instead of block (loosens the gate); judging only the AskUserQuestion input (does not satisfy KIT-D136); keeping the first-call block as the protocol (one wasted call per questionnaire).

**Assistant-added:** Related KIT-T881, KIT-D129, KIT-D136.
