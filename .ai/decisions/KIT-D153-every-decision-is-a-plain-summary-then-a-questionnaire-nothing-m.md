---
id: KIT-D153
title: Every decision is a plain summary, then a questionnaire; nothing more is required of it
summary: A decision requirement comes with a summary and then an AskUserQuestion; the brief gate checks that a summary came first, not exact sentence shapes
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris), answering whether the KIT-D146 rules section stays loud or becomes a pointer
---


**Maintainer:** "I HAVE NO FUCKING IDEA. I JUST WANT EVERY FUCKING DECISION REQUIRMENT TO COME WITH A FUCKING SUMMARY AND THEN A QUESTIONNAIRE. IS THAT SO FUCKING HARD?!"

**Decision:**
1. Every decision put to the maintainer is a plain-language summary (what is being decided, what each option does and costs, the recommendation), then an AskUserQuestion. That is the whole requirement.
2. The global rules say exactly that, in one short section. They carry no hand-kept copy of a gate's sentence shapes.
3. The question-brief gate enforces no more than "a summary came before the questionnaire". A gate that blocks a real summary because a line is not in an exact shape is the defect, not the session.

**Why:** Sessions and the maintainer lose turns on every questionnaire to brief-shape blocks (KIT-T846, T854, T872, T876, T881, T906); the shapes also drifted from the gate (d81ed6d) inside a day.

**Rejected:** keeping the exact-shape protocol in the rules (drifts, and the gate still misreads it, KIT-T906); a bare pointer to `q gates question` (the maintainer did not pick it).

**Assistant-added:** Related KIT-D129, KIT-D142, KIT-D146, KIT-T881, KIT-T906. The maintainer's choice was asked as "keep loud vs pointer only"; he chose neither and stated this instead.
