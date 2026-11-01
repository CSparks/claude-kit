---
id: KIT-T666
title: commit-gate commit-foreign (KIT-T407) false positive: files written by this session in parallel Write batches are missing from the session w
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T06:15:57Z
updated: 2026-10-28T06:15:57Z
---

## Description
commit-gate commit-foreign (KIT-T407) false positive: files written by this session in parallel Write batches are missing from the session write-log, so the gate blocks them as foreign (7 of 54 files in D:/dev/rg-lanes/dialogue, one per parallel batch; looks like a race on the write-log append). Also: before staging, the gate reads the collapsed untracked directory entry from git status and flags the whole directory; use git status -uall.

kit-bug-shape: cap:bug:commit-gate-commit-foreign-kit-t407-false-positi
first seen in dialogue. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 06:15] (created) bug — commit-gate commit-foreign (KIT-T407) false positive: files written by this session in parallel Write batches are missing from the session w
