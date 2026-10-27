---
id: KIT-T614
title: dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T16:09:33Z
updated: 2026-10-21T16:09:33Z
---

## Description
dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI work) because the brief mentioned that another worker was landing 'rg-screens volume rows' in the same lane. A passing mention of a UI crate is not UI work; the check should key on the brief's own task, not on any UI noun. Hit 2026-10-21 in stiletto-2349.

kit-bug-shape: cap:bug:dispatch-guard-ui-framework-first-false-positive
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 16:09] (created) bug — dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI
