---
id: KIT-T387
title: branch-guard false positive: in a compound command 'cd /d/dev/groovegrid && ... && cd /d/dev && git clone <new-repo>' it attributes the clon
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-07T19:39:01Z
updated: 2026-10-07T19:39:01Z
---

## Description
branch-guard false positive: in a compound command 'cd /d/dev/groovegrid && ... && cd /d/dev && git clone <new-repo>' it attributes the clone to the FIRST cd's project (reports 'clones into project D:/dev/groovegrid'), ignoring the later cd. Blocks the first checkout of a brand-new repo (CSparks/pricklelab split from groovegrid/website). Fix: track cwd through each && segment / resolve the clone target dir.

kit-bug-shape: cap:bug:branch-guard-false-positive-in-a-compound-comman
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 19:39] (created) bug — branch-guard false positive: in a compound command 'cd /d/dev/groovegrid && ... && cd /d/dev && git clone <new-repo>' it attributes the clon
