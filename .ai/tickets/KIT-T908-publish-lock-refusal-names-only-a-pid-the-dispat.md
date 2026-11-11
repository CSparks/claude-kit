---
id: KIT-T908
title: publish.lock refusal names only a pid: the dispatcher cannot tell its own publish from another session's, and a reused pid blocks forever (2026-11-08 pid 2260 held 4 to 24 minutes)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T22:36:44Z
updated: 2026-11-08T22:36:44Z
---

## Description
On 2026-11-08 npm run publish:runtime refused: another publish holds publish.lock (pid 2260, since 22:06:50Z). The maintainer has one terminal on this project. The lock and pid were gone by 22:31:37Z, so a publish ran 4 to 24 minutes, past KIT-D104's 5-minute ceiling. The lock names only a pid; sessions cannot tell whose publish it is. Fix: (a) lock records command line, cwd, parent pid; the refusal prints holder command line, project, parent and age; (b) holder identified from reflog: 297838d committed 22:06:41Z by another session, publish started 22:06:49Z, publish log not retained; (c) over-ceiling cause not recoverable from retained logs: the lock now carries the evidence; (d) a lock whose pid is alive but runs a different command (pid reuse) is reclaimed by the publisher; a dead pid is already reclaimed (runtime-publish.test.mjs KIT-T737).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T536, KIT-T737, KIT-T839
### comment #1 [2026-11-08 22:39] @claude
Findings. (b) Reflog (local CST, UTC-6): 297838d committed 16:06:41 = 22:06:41Z by another session; pid 2260 started 22:06:49Z = 8 s later, so it was that session's own npm run publish:runtime (or a hook after its commit); not our attempt (our commits 703df8b at 22:08:39Z and db2f606 22:09:25Z came after). The publish log was not retained (publish-followup.log is overwritten per run), so who started it cannot be proven. (c) A publish now runs 139 s suite + 18 s export = about 160 s wall (this run, runtime db2f606); the 4 to 24 minute holder time is unexplained by retained logs, so the lock now records command line, cwd and parent pid for the next occurrence; no over-ceiling bug filed because the cause is unknown and the existing KIT-T839 covers hub-module publish length. (d) A dead pid was already reclaimed by the publisher (runtime-publish.test.mjs KIT-T737 negative control); added: a live pid running a non-publish process (pid reuse) is reclaimed too. Tests: scripts/runtime-publish.test.mjs 36 passed; negative control (command check removed) crashes the new reclaim test.

## History
- [2026-11-08 22:36] (created) bug — publish.lock refusal names only a pid: the dispatcher cannot tell its own publish from another session's, and a reused pid blocks forever (2026-11-08 pid 2260 held 4 to 24 minutes)
- [2026-11-08 22:39] (comment) @claude: Findings. (b) Reflog (local CST, UTC-6): 297838d committed 16:06:41 = 22:06:41Z by another session; pid 2260 started 22: (full comment #1 in ## Notes)
- [2026-11-08 22:39] (landed) ecad15b runtime-publish: the lock records command line, project and parent; a refusal names holder, age and parent; a lock whose
