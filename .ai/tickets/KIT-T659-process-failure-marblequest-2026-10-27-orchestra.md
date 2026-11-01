---
id: KIT-T659
title: Process failure (marblequest 2026-10-27): orchestrator dispatched a Plan agent to design 'more enemies/loot' for a PORT project without nami
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T01:57:08Z
updated: 2026-10-28T01:57:08Z
---

## Description
Process failure (marblequest 2026-10-27): orchestrator dispatched a Plan agent to design 'more enemies/loot' for a PORT project without naming the fidelity source (wordslide-codex marble-madness); the plan re-proposed source features as additions (Splitter = source SplitOnDeath) and missed unported ones (Centipede, Door, generation strategies). Root cause: no gate/brief rule that a plan/design dispatch in a port project must first diff the source reference vs the port. Kit fix: plan-dispatch guard or orient line that injects the project's declared fidelity source into design briefs.

kit-bug-shape: cap:bug:process-failure-marblequest-2026-10-27-orchestra
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 01:57] (created) bug — Process failure (marblequest 2026-10-27): orchestrator dispatched a Plan agent to design 'more enemies/loot' for a PORT project without nami
