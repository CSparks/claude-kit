---
id: KIT-T909
title: ended-worker notice (UserPromptSubmit, KIT-D132) credits a main-thread broker job to a finished agent: 'RESULT READY: j-mw8exlvw-1y7pox meas
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T910
superseded_by:
created: 2026-11-08T23:06:30Z
updated: 2026-11-08T23:06:30Z
---

## Description
ended-worker notice (UserPromptSubmit, KIT-D132) credits a main-thread broker job to a finished agent: 'RESULT READY: j-mw8exlvw-1y7pox measured for DE-T222; agent adbfc7968b826a763 finished it and is not resumable here'. j-mw8exlvw was submitted 2026-11-08 by the dirt-empire main thread (submit.mjs --no-patch --measure --ticket DE-T222), no agent; adbfc79 is the DE-T300 worker from 2026-11-05. finished.log row shows agent=-. The notice must attribute by the job's own submitter (agent=- means main thread, not an ended worker) and never surface the orchestrator's own measure jobs as an ended worker's open work.

kit-bug-shape: cap:bug:ended-worker-notice-userpromptsubmit-kit-d132-cr
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-08 23:06] (created) bug — ended-worker notice (UserPromptSubmit, KIT-D132) credits a main-thread broker job to a finished agent: 'RESULT READY: j-mw8exlvw-1y7pox meas
- [2026-11-09 17:38] (landed) bc81ba6 handback notices: a finished job belongs to its ledger submitter and a main-thread submit to no worker; a SendMessage re
