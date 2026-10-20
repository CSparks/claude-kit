---
id: KIT-T600
title: Process failure (dirt-empire 2026-10-19, DE-T175 bike frame in Blender): a 3D joint-embedding check written for frame v2 was not re-run on v
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-20T02:38:53Z
updated: 2026-10-20T02:38:53Z
---

## Description
Process failure (dirt-empire 2026-10-19, DE-T175 bike frame in Blender): a 3D joint-embedding check written for frame v2 was not re-run on v3/v4 because asset checks live in throwaway per-call scripts; Chris found floating, unjoined tubes. Root cause: no persistent, re-runnable asset invariant script for Blender-authored assets (joints embedded, single connected piece, manifold) that every rebuild runs automatically.

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-19-de-t175-b
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-20 02:38] (created) bug — Process failure (dirt-empire 2026-10-19, DE-T175 bike frame in Blender): a 3D joint-embedding check written for frame v2 was not re-run on v
