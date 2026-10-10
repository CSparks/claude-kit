---
id: KIT-T345
title: broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a depende
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T08:38:37Z
updated: 2026-10-06T08:38:37Z
---

## Description
broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a dependency; dirt-empire 2026-10-06 j-muwezqz9 needed a follow-up lock-only landing abffac0). Landing should include Cargo.lock when the verify step changed it.

kit-bug-shape: cap:bug:broker-land-commits-only-the-patch-s-paths-and-l
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 08:38] (created) bug — broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a depende
