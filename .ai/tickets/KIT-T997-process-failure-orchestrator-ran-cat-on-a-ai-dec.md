---
id: KIT-T997
title: process failure: orchestrator ran cat on a .ai/decisions file to learn the t decide draft format; store-grep gate blocked it (2026-11-10, ma
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:36:02Z
updated: 2026-11-11T03:36:02Z
---

## Description
process failure: orchestrator ran cat on a .ai/decisions file to learn the t decide draft format; store-grep gate blocked it (2026-11-10, marblequest). Root cause: t decide --file prints no draft template in t --help; prevention: t decide --help (or a bare t decide) prints the draft skeleton.

kit-bug-shape: cap:bug:process-failure-orchestrator-ran-cat-on-a-ai-dec
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:36] (created) bug — process failure: orchestrator ran cat on a .ai/decisions file to learn the t decide draft format; store-grep gate blocked it (2026-11-10, ma
