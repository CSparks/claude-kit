---
id: KIT-T544
title: broker land fails on 'index.lock: File exists' with no retry and no holder logged
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:57Z
updated: 2026-10-16T14:57:57Z
---

## Description
Failed land mvab6qyy. Plausible holder: the root recheck's git status (deferred.mjs:58) recursing into the submodule (unverified). Fix: bounded retry, log the holder if findable. Source: broker-vetting-2026-10-16 D8.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T301

## History
- [2026-10-16 14:57] (created) bug — broker land fails on 'index.lock: File exists' with no retry and no holder logged
