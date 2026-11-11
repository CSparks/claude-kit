---
id: KIT-D131
title: Organizers never delegate or accept work through cross-terminal messages
summary: Clarify: 'frameworks' means rapid-game
date: 2026-11-03
supersedes: 
source: conversation 2026-11-03
revised: 2026-11-03
---



**Decision:** Chris 2026-11-03, verbatim: "It should and ANY fucking organizer agent (root agent in a session) should _ALWAYS_ fucking spin up a separate agent for KIT fixes. NO FUCKING ORGANIZERS SHOULD EVER BE HANDING OFF WORK THROUGH CROSS TERMINAL COMMUNICATION. THAT IS STRICTLY FOR HEADS-UP NOTIFICATIONS ABOUT THE BROKER, OR BEING BLOCKED BY SOMETHING THE OTHER IS DOING. IT IS NOT FOR DELEGATING TO ANOTHER FUCKING TERMINAL ___EVER__ UNLESS I SAY SO."

Addition, Chris 2026-11-03, verbatim: "I would add to that that cross terminal conversation SHOULD include any changes to the frameworks in multiple workspaces that affect multiple workspaces that are open."
Clarification, Chris 2026-11-03, verbatim: "This means rapid-game."

**Why:** In a groovegrid session the organizer accepted dirt-empire-8e's cross-session request for a kit fix, forwarded it to its kit agent, and replied with the runtime sha, unasked.

**How to apply:** A peer session asking this session to fix, claim or publish anything: decline, tell the maintainer, do nothing else. A kit misbehaviour found in this session goes to this session's own kit agent (KIT-D094). Cross-session messages are allowed for: broker heads-ups, "blocked by what you are doing", and a heads-up that a rapid-game framework change touches several open workspaces (what changed, the sha, what to re-pull; no request for work). Needs hook enforcement on acting on a cross-session-message work request and on SendMessage delegation to another session.
