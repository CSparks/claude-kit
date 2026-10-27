---
id: KIT-T644
title: tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resol
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T03:16:16Z
updated: 2026-10-27T03:16:16Z
---

## Description
tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resolves the unexpanded $S path relative to the checkout instead of treating it as unknown/outside

kit-bug-shape: cap:bug:tree-delete-gate-blocks-rm-rf-s-out-where-s-is-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 03:16] (created) bug — tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resol
- [2026-10-27 03:16] (comment) seen again in dirt-empire: tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resolves the unexpanded $S path relative to the checkout instead of treating it as unknown/outside
- [2026-10-27 03:16] (asked again) 2026-10-27 — cap:bug:tree-delete-gate-blocks-rm-rf-s-out-where-s-is-a
