---
id: KIT-T995
title: process failure: an Explore agent (marblequest, 2026-11-10, MarbleRace2 inventory) used a Bash grep for source discovery and a Bash sed on t
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:35:59Z
updated: 2026-11-11T03:35:59Z
---

## Description
process failure: an Explore agent (marblequest, 2026-11-10, MarbleRace2 inventory) used a Bash grep for source discovery and a Bash sed on the .ai store; both blocked by hooks, neither ticketed by the agent. Root cause: read-only Explore agents do not carry the q-only and no-text-tool-on-.ai rules; prevention: inject both into every Explore brief or the agent definition.

kit-bug-shape: cap:bug:process-failure-an-explore-agent-marblequest-202
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:35] (created) bug — process failure: an Explore agent (marblequest, 2026-11-10, MarbleRace2 inventory) used a Bash grep for source discovery and a Bash sed on t
