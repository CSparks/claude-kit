---
id: KIT-T663
title: t new run inside a clone of an adopted repo whose .ai/ is gitignored (rapid-game clone at D:/dev/rg-lanes/_land, only .ai/decisions tracked)
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T05:46:39Z
updated: 2026-10-28T05:46:39Z
---

## Description
t new run inside a clone of an adopted repo whose .ai/ is gitignored (rapid-game clone at D:/dev/rg-lanes/_land, only .ai/decisions tracked) silently filed 7 tickets into the UNBOUNDED store as UNB-T044..050 instead of refusing or resolving the repo store via the registry; had to t move them to RG-T287..293. Root cause: store resolution treats a partial .ai/ dir as absent and falls through to unbounded with no warning.

kit-bug-shape: cap:bug:t-new-run-inside-a-clone-of-an-adopted-repo-whos
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 05:46] (created) bug — t new run inside a clone of an adopted repo whose .ai/ is gitignored (rapid-game clone at D:/dev/rg-lanes/_land, only .ai/decisions tracked)
