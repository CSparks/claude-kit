---
id: KIT-T1308
title: source-shell-write/delete gate misfired on a 't notes' command whose quoted prose had no rm/del: blocked as 'deletes a source file by hand (
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T09:37:19Z
updated: 2026-11-16T10:06:36Z
---

## Description
source-shell-write/delete gate misfired on a 't notes' command whose quoted prose had no rm/del: blocked as 'deletes a source file by hand (./*)'. Command was t notes RDG-T072 with a long multi-line quoted note plus '; git add docs/perf/... ; git status --short | head -3'

kit-bug-shape: cap:bug:source-shell-write-delete-gate-misfired-on-a-t-n:f6c73689
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-16 09:37] (created) bug — source-shell-write/delete gate misfired on a 't notes' command whose quoted prose had no rm/del: blocked as 'deletes a source file by hand (
- [2026-11-16 10:06] (status) todo → review
