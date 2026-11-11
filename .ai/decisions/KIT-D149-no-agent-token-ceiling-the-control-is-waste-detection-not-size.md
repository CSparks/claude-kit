---
id: KIT-D149
title: No agent token ceiling; the control is waste detection, not size
summary: Amends KIT-D116: an agent is not retired for its context size; the kit detects tokens spent monitoring output that changes nothing
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** "Honesty, it shouldn't be a limit. It should be an issue of finding out if the tokens are being wasted observing an action that's not doing anything." and "I dont' care about the tokens if they're being used to get work done. I don't want them wasted monitoring some verbose bullshit."

**Decision:** The 300k context ceiling of KIT-D116 (dispatch.context_ceiling_tokens) is to be removed as a retire trigger, with no replacement size limit or size warning. The control is a waste detector: tokens an agent spends monitoring or observing output that changes nothing (polling a build or background task, re-reading unchanged output, repeating a command, retrying a blocked call with no change). An agent doing productive work keeps running at any size. The handoff block and fresh-agent briefing of KIT-D116 stay for an agent that ends or is flagged for waste.

**Why:** Chris 2026-11-08, on seeing a writer at 318k tokens flagged for retirement while it did real work. Size measures nothing he cares about; wasted observation does.

**Assistant-added:** Until the kit agent ships the detector and removes the retire trigger (ticket filed the same turn), the 300k ceiling is still what the dispatch guard enforces. Measurement candidates: calls with no file write, commit, new test result or new output; the agents.jsonl token and tool-call counts; transcript tool results compared call to call.
