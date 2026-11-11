---
id: KIT-T884
title: Broker as machine-wide resource controller (air traffic control): admit builds against a CPU/memory/disk budget across all projects and sess
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:47:16Z
updated: 2026-11-07T17:47:16Z
---

## Description
Broker as machine-wide resource controller (air traffic control): admit builds against a CPU/memory/disk budget across all projects and sessions, never 4 concurrent builds; foreign cargo (hand-run cargo, rapid-game pre-push gate, nextest) must join the same admission; scope-aware time budget per KIT-D137. Chris 2026-11-07: 'the broker needs to be an air traffic controller re: system resources. It's not OK to tie up the machine with 4 builds at once.' Related: KIT-T860, KIT-T873/T874, KIT-D105.

kit-bug-shape: cap:feature:broker-as-machine-wide-resource-controller-air-t
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 17:47] (created) feature — Broker as machine-wide resource controller (air traffic control): admit builds against a CPU/memory/disk budget across all projects and sess
