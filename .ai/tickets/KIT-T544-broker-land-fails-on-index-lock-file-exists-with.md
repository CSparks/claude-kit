---
id: KIT-T544
title: broker land fails on 'index.lock: File exists' with no retry and no holder logged
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:57Z
updated: 2026-10-16T16:49:48Z
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
### comment #1 [2026-10-16 16:49] @claude
Fixed: git add and git commit in the landing retry up to 8 times at 1 s on 'Unable to create ...index.lock: File exists'; a lock that stays fails the job naming the lock path, its age and the git pids alive, and is never removed. Holder of mvab6qyy still unverified (the root recheck's git status theory was not tested; the recheck now also yields to every lane, KIT-T540). index-lock.test.mjs 4 passed (persistent-lock case red before). Broker glob 316 passed.

## History
- [2026-10-16 14:57] (created) bug — broker land fails on 'index.lock: File exists' with no retry and no holder logged
- [2026-10-16 16:49] (comment) @claude: Fixed: git add and git commit in the landing retry up to 8 times at 1 s on 'Unable to create ...index.lock: File exists' (full comment #1 in ## Notes)
- [2026-10-16 16:49] (status) todo → review
