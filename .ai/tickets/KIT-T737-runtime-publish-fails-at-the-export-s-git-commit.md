---
id: KIT-T737
title: runtime-publish fails at the export's git commit step and hides git's error text; six attempts at adcd3a8/9dc81e4 failed on 2026-10-30, so c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T22:20:49Z
updated: 2026-10-30T22:26:05Z
---

## Description
runtime-publish fails at the export's git commit step and hides git's error text; six attempts at adcd3a8/9dc81e4 failed on 2026-10-30, so current stays f5d291b and T732/T733/T452/T734/T735/T736 are not live. Overlapping publishes from several sessions also leave .kit-verify-* dirs and q-server processes behind. Needs: surface the git stderr, a machine-wide publish lock so two publishes cannot overlap, and cleanup of its scratch dir and child processes on failure.

kit-bug-shape: cap:bug:runtime-publish-fails-at-the-export-s-git-commit
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 7718529: scripts/runtime-publish-guard.mjs adds withPublishLock (one publish per runtime dir, dead holder taken over), gitOrThrow (git stderr in the error) and stopProcessesUnder (q-server children of the scratch export stopped before it is deleted, rm retried). KIT-T532 (git init failures under load) shares the load/contention theme only; no change there. The commit failure itself did not reproduce standalone; with the lock a repeat will now carry git's text. Evidence: scripts/runtime-publish.test.mjs 25 passed, runtime-wiring.test.mjs 22 passed.

## History
- [2026-10-30 22:20] (created) bug — runtime-publish fails at the export's git commit step and hides git's error text; six attempts at adcd3a8/9dc81e4 failed on 2026-10-30, so c
- [2026-10-30 22:25] (landed) 7718529 runtime-publish: one publish at a time, git's stderr in the error, scratch export and its processes stopped on exit; imp
- [2026-10-30 22:26] (status) todo → review
