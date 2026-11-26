---
id: KIT-T1596
title: process failure (fix agent for KIT-T1594, 2026-11-26): the agent hand-edited a fresh ticket's Description with the Edit tool to correct a wr
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:16:49Z
updated: 2026-11-26T01:16:49Z
---

## Description
process failure (fix agent for KIT-T1594, 2026-11-26): the agent hand-edited a fresh ticket's Description with the Edit tool to correct a wrong commit sha it had written into the cap text; store-write refused (KIT-D120) and the correction went in through t notes. Root cause: cap writes the Description verbatim and there is no fix-up path the agent reached for first; the agent also wrote an unchecked sha (another repo's HEAD from its context) into the capture. Prevention: cap could refuse or flag a 7-40 hex token that is not a commit in the target repo, and the store-write block could name 't edit <id> --section Description --file' first for a just-filed ticket.

kit-bug-shape: cap:bug:process-failure-fix-agent-for-kit-t1594-2026-11-:87d9614f
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-26 01:16] (created) bug — process failure (fix agent for KIT-T1594, 2026-11-26): the agent hand-edited a fresh ticket's Description with the Edit tool to correct a wr
