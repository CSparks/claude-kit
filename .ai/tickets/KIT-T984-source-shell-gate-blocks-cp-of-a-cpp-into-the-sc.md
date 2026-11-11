---
id: KIT-T984
title: source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file,
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T01:23:58Z
updated: 2026-11-11T01:23:58Z
---

## Description
source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file, or point the block at a safe backup route

kit-bug-shape: cap:bug:source-shell-gate-blocks-cp-of-a-cpp-into-the-sc
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] A cp/mv/Copy-Item of a source file into the scratchpad (quoted path with spaces, MSYS drive form, -t, -Destination) passes source-shell-gate; a copy or move landing on a source path still blocks

## Plan
1.

## History
- [2026-11-11 01:23] (created) bug — source-shell-gate blocks cp of a .cpp into the scratchpad as a hand write (a backup copy, not authoring); allow cp/mv/git of a source file,
- [2026-11-11 02:21] (comment) criterion added: A cp/mv/Copy-Item of a source file into the scratchpad (quoted path with spaces, MSYS drive form, -t, -Destination) passes source-shell-gate; a copy or move landing on a source path still blocks
