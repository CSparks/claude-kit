---
id: KIT-D094
title: One standing kit agent per session takes every kit fix whole; an unreachable device is a maintainer action, never a wait
summary: a warm writer in the claude-kit checkout files, diagnoses, fixes, tests and publishes every kit misbehaviour, with no inline orchestrator diagnosis; deck-deploy and any device step fail fast and tell the maintainer
date: 2026-10-14
supersedes: 
source: Chris 2026-10-14 (KIT-T480, verbatim below); built 2332e5f (deck-deploy reachability), 4969079 (base CLAUDE.md + orient); strengthens the KIT-T286 rule
---


**Decision:**
- **Standing kit agent.** Every session keeps ONE kit agent: a writer in the claude-kit checkout, reused warm for each fix.
  - The moment a kit misbehaviour shows up, the orchestrator hands it over whole: ticket, diagnosis, fix with tests, npm test, `publish:runtime`.
  - The orchestrator does no inline kit diagnosis. It relays the runtime sha and returns to its own work.
  - The rule lives in `user-config/CLAUDE.global.md` under the KIT-T286 rule, and orient replays it with DISPATCH NOW.
- **Unreachable devices.** An unreachable device is a maintainer action, announced at once. It is never a background wait, poll or watcher.
  - `deck-deploy` (deploy, `watch`, `check`) tests the Deck's ssh port for 5 s before any build. When the Deck is unreachable it exits 3 with "MAINTAINER ACTION: Deck unreachable … wake it and connect Wi-Fi" and writes `~/.claude/deck-deploy/alert.txt`, which orient shows.
  - `watch` runs detached, logging to a file, so it never holds its caller.

**Why:** Chris 2026-10-14:
- "Deck deploy has been running for 3 hours and the timer stopped. That seems like a big fucking process failure."
- "If deck deploy can't run, it shouldn't wait. It likely means _I_ need to be notified to make sure the deck is available."
- "Please spin up an agent to handle any kit fixes like that. That should be policy."

That night the orchestrator ran its own 6 h ssh poll against the offline Deck, and a silent `deck-deploy watch` sat for hours. The orchestrator also hunted the watcher's launcher inline instead of handing it to the kit agent.

**Rejected:**
- A fresh agent per fix: cold every time.
- Orchestrator triage before the hand-off: that is the same inline diagnosis.
- Background waits on a device only the maintainer can wake.
