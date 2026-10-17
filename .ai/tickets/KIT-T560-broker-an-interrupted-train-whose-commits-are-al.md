---
id: KIT-T560
title: broker: an interrupted train whose commits are already on local main re-runs instead of resuming the push. Round 13 (ST-T904): train-j-mvbjm
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T21:12:27Z
updated: 2026-10-17T21:42:47Z
---

## Description
broker: an interrupted train whose commits are already on local main re-runs instead of resuming the push. Round 13 (ST-T904): train-j-mvbjm7ge-8educv was killed in its pre-push gate with 3 commits made (6a29fb46 4fcfefda 3e9083d9, local main ahead of origin by 3); on runtime 1fb866b the re-run re-applied the patches onto the tree that already held them, failed at land 'git commit' (all 3 members failed 20:36Z) and raised HEALTH own-fault:restore-mismatch on rg-physics-pbd/src/systems.rs. Expected: see the commits already on main (journal 'committed' or patch == HEAD content) and just run the gate + push. The commits stayed unpushed until the orchestrator pushed by hand. Test: kill in pre-push gate, restart, assert one push and no re-apply.

kit-bug-shape: cap:bug:broker-an-interrupted-train-whose-commits-are-al
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Reproduced: a train killed in its pre-push gate whose HEAD was then moved off the branch (a root-lane pin checkout of rapid-game; the daemon log shows 'restored the tree after interrupted job train-...; it re-runs') failed all 3 members, as in round 13. Cause: commitStands only looked at HEAD, so recovery restored pre-images over the committed files. Fix: markCommitted records the branch; commitStands accepts a commit under that branch; resumeLanding puts the branch back before the push. scripts/broker/train-resume.test.mjs: kill in gate, restart, 3 landed, one push received by the remote, no extra commit; the moved-off variant fails 3/3 without the fix. 2 passed.

## History
- [2026-10-17 21:12] (created) bug — broker: an interrupted train whose commits are already on local main re-runs instead of resuming the push. Round 13 (ST-T904): train-j-mvbjm
- [2026-10-17 21:42] (status) todo → review
