---
id: KIT-T685
title: broker: drop a redundant --pin at submit when HEAD's gitlink already contains the pinned sha, and stop agents hand-pinning where auto_pin: t
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:27:37Z
updated: 2026-10-28T22:27:37Z
---

## Description
broker: drop a redundant --pin at submit when HEAD's gitlink already contains the pinned sha, and stop agents hand-pinning where auto_pin: true queues the pin (train-form excludes every job with pins; 47 of 241 dirt-empire root jobs on 2026-10-28 carried a submodule-path/pin diff). Strip the no-op pin, say so in the submit receipt

kit-bug-shape: cap:feature:broker-drop-a-redundant-pin-at-submit-when-head-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 22:27] (created) feature — broker: drop a redundant --pin at submit when HEAD's gitlink already contains the pinned sha, and stop agents hand-pinning where auto_pin: t
