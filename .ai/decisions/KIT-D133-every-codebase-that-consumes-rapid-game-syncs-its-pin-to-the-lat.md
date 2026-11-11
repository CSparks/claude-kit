---
id: KIT-D133
title: Every codebase that consumes rapid-game syncs its pin to the latest RG whenever a session works on it
summary: Any session working a consumer of rapid-game brings its pin to the latest RG and restores compatibility when work resumes; an idle project may lag
date: 2026-11-06
supersedes: 
source: Chris 2026-11-06, stiletto-2349 session
revised: 2026-11-06
---


**Status:** accepted
**Decided by:** Chris

**Decision:** Any codebase that uses rapid-game (RG) pulls and updates its compatibility with the latest RG any time a session works on that project. Stiletto and Dirt Empire both sync their pin to the latest RG; neither sits behind.

**Maintainer:** "DE is pushing and should be on the latest RG, just like Stiletto."
"They should both be syncing their pin to the latest."
"ANY codebase that usees RG should be pulling and updating compatibility with the latest RG any time we work on a project that consumes it."

Addendum, same day: "It's OK if a project falls behind when not being worked on, but it needs to be brought up to the latest when work resumes."

**Why:** Consumers drifting on old pins hides breakage until a bump lands in a surprise place, and a framework push (2026-11-06, ST-T959 radar icons) changes shared code that every consumer must still build against.

**How to apply:** At the start of work on a consumer, fetch RG, bump the pin to origin/main, build, and fix compatibility inside the signed bill. A framework change that lands also triggers the bump in every consumer touched next. Orient should flag a consumer whose pin is behind RG origin/main (kit feature).

**Rejected:** Leaving each project on its own pin until it needs something.
