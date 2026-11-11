---
id: KIT-T1000
title: process failure: orchestrator captured a maintainer ruling with cap, then recorded it with t decide --file WITHOUT --from <inbox id>, leavin
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:41:09Z
updated: 2026-11-11T03:41:09Z
---

## Description
process failure: orchestrator captured a maintainer ruling with cap, then recorded it with t decide --file WITHOUT --from <inbox id>, leaving the capture un-promoted and tripping the KIT-T938 stop block (2026-11-10, marblequest, MAR-D020). Root cause: cap prints no reminder that a quoted ruling must be promoted with --from; prevention: cap output for a capture that quotes the maintainer names the exact t decide --from <id> command.

kit-bug-shape: cap:bug:process-failure-orchestrator-captured-a-maintain
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:41] (created) bug — process failure: orchestrator captured a maintainer ruling with cap, then recorded it with t decide --file WITHOUT --from <inbox id>, leavin
