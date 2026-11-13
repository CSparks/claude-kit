---
id: KIT-D168
title: Every process failure is followed by an agent dispatch; a need for the maintainer is a questionnaire
summary: stop, capture the root cause, dispatch an agent the same turn to fix or prevent; a need for him goes in an AskUserQuestion or it is a process failure
date: 2026-11-13
supersedes: 
source: conversation 2026-11-13 (Chris, road-generator main thread)
---


**Maintainer:** "Every process failure needs to be followed up by dispatching an agent to attempt to fix/prevent future failures." And: "If you need something, that needs to be a questionnaire or it's a process failure." And: "I have to say this way too often."

**Decision:** A process failure is stop, capture naming the root cause, and DISPATCH an agent the same turn to fix the cause or build the prevention; a capture alone does not close one. This extends KIT-D145 (every kit bug gets an agent at once) from kit bugs to every process failure. A need for the maintainer (approval, a decision, an action only he can perform) is put in an AskUserQuestion with a plain summary first and the recommended option first; written as prose it is itself a process failure. Two Stop hooks enforce it: `prose-ask` (a closing reply that asks him for something in prose with no questionnaire that reached him; KIT-T1130, KIT-T1136) and `process-failure-dispatch` (a process-failure capture with no Agent, Task or SendMessage call in the turn).

**Why:** KIT-T1130 and KIT-T1136 recurred within hours: a decision parked as "waiting on you" across about ten replies, then "One thing I need from you" with no questionnaire. The global contract already forbade it and nothing enforced it; a capture with no fix agent leaves the cause in place.

**Rejected:** a capture as the end of a process failure (the cause stays; the recurrence is the proof); judging a prose request by wording alone with no exemptions (a quoted maintainer line, a subagent report or a reply to his own question is not a violation).
