---
id: KIT-T912
title: RETIRED WITH HANDOFF notice (UserPromptSubmit, KIT-D132) fires for DE-T222 worker a242564ac5c94f82a that the orchestrator resumed by SendMes
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T16:07:59Z
updated: 2026-11-09T16:07:59Z
---

## Description
RETIRED WITH HANDOFF notice (UserPromptSubmit, KIT-D132) fires for DE-T222 worker a242564ac5c94f82a that the orchestrator resumed by SendMessage inside the signed bill (2026-11-09 ~16:00); the notice says 'no dispatch has cited it'. A SendMessage resume of the same agent id must count as a citing dispatch, and an agent with a live background broker job is not retired.

kit-bug-shape: cap:bug:retired-with-handoff-notice-userpromptsubmit-kit
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 16:07] (created) bug — RETIRED WITH HANDOFF notice (UserPromptSubmit, KIT-D132) fires for DE-T222 worker a242564ac5c94f82a that the orchestrator resumed by SendMes
- [2026-11-09 17:38] (landed) bc81ba6 handback notices: a finished job belongs to its ledger submitter and a main-thread submit to no worker; a SendMessage re
- [2026-11-09 21:20] (comment) @claude: Reproduced against D:/dev/dirt-empire (read-only): a242564ac5c94f82a resumed by SendMessage at 20:48:22Z and 21:00:34Z;  (full comment #1 in ## Notes)
### comment #1 [2026-11-09 21:20] @claude
Reproduced against D:/dev/dirt-empire (read-only): a242564ac5c94f82a resumed by SendMessage at 20:48:22Z and 21:00:34Z; each resumed run ends with a new SubagentStop row (21:01:14Z), after which reopenState needs the resume to be newer than the retirement and the old Handoff (6) is listed again. Fix: resume-check records the agent's Handoff block count per ticket; a resume covers the Handoff blocks it saw, so the resumed run retiring again owes nothing until it writes a newer Handoff block.
- [2026-11-09 21:22] (landed) e2b8b51 handback: a SendMessage resume records the agent's Handoff block count per ticket and covers those blocks, so the resume
- [2026-11-09 21:28] (comment) @claude: Coordinator report 2026-11-09 (dirt-empire-f0): 'NOT fixed on runtime 4b02eb2. The notice still prints RETIRED WITH HAND (full comment #2 in ## Notes)
### comment #2 [2026-11-09 21:28] @claude
Coordinator report 2026-11-09 (dirt-empire-f0): 'NOT fixed on runtime 4b02eb2. The notice still prints RETIRED WITH HANDOFF: DE-T222 (a242564ac5c94f82a) has open work and no dispatch has cited it, though the dirt-empire orchestrator resumed that agent with several SendMessage messages naming DE-T222 today and it had live broker jobs.' Fix landed e2b8b51 and corrected in the follow-up commit (silent reopened agents still listed). Not cleared by publish on dirt-empire: its 21:00:34Z resume row has no handoffs field, so the notice there clears at the next SendMessage resume or with ack.mjs --handoff a242564ac5c94f82a --reason ... . Known edge: a Handoff heading counts for the agent whether or not its labels are complete (a new block missing Files: still raises the count and re-lists).
- [2026-11-09 21:29] (landed) 9e53973 handback: a silent resumed agent is still listed (the resume covers a Handoff only once the resumed run retires), and th
