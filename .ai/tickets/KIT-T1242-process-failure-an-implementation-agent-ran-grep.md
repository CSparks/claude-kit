---
id: KIT-T1242
title: Process failure: an implementation agent ran grep -rn over the source tree after reading q-first rules; query-gate blocked it. Root cause: a
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T08:24:25Z
updated: 2026-11-15T08:24:25Z
---

## Description
Process failure: an implementation agent ran grep -rn over the source tree after reading q-first rules; query-gate blocked it. Root cause: agent habit of tree grep when a q equivalent exists. Prevention: dispatch briefs already say q-only; gate redirect worked.

kit-bug-shape: cap:bug:process-failure-an-implementation-agent-ran-grep:44ce9e13
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-15 08:24] (created) bug — Process failure: an implementation agent ran grep -rn over the source tree after reading q-first rules; query-gate blocked it. Root cause: a
- [2026-11-15 09:31] (comment) @kit-agent: Same class again: a kit agent (KIT-T1245 work, 2026-11-15) ran a tree-wide grep on Bash and a shell heredoc/cp into a repo path; both blocked by the gates. No new ticket.
