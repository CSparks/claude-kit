---
id: KIT-T520
title: broker lane (d008eaa) reports a rapid-game job LANDED while origin/main never moved: j-mv9st43c-ramtq3 (RG-T188 C1) result status landed, he
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:38:48Z
updated: 2026-10-15T18:01:52Z
---

## Description
broker lane (d008eaa) reports a rapid-game job LANDED while origin/main never moved: j-mv9st43c-ramtq3 (RG-T188 C1) result status landed, head 378a0f6e, timings push 3625 ms exit ok, superSha null; but 'git ls-remote origin main' = 33f705fa (the parent), no remote ref contains 378a0f6e, the submodule's origin/main reflog shows no 'update by push' at 17:36Z, and the lane log holds only the '-> landed' line (no push output logged). The pre-push gate ran in rapid-game (j-mv9st43c-ramtq3-pre-push.log, gate green). Suspects: the push ran in the wrong cwd (superproject root: stiletto origin/main was already up to date, hence 3.6 s and ok), or the lane's push went to a ref other than main, or verify compared the wrong repo's HEAD. Needs: the push command line + its stdout in the result, the lane cwd asserted = submodule path, and 'landed' only after ls-remote shows the sha. Local commit 378a0f6e is intact on the submodule checkout, gate-green; the next train (L1/L3) is building on it

kit-bug-shape: cap:bug:broker-lane-d008eaa-reports-a-rapid-game-job-lan
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 17:38] (created) bug — broker lane (d008eaa) reports a rapid-game job LANDED while origin/main never moved: j-mv9st43c-ramtq3 (RG-T188 C1) result status landed, he
- [2026-10-15 17:40] (comment) @claude: ROOT CAUSE (stiletto-2349-68, 2026-10-15 18:05Z): the submodule checkout was DETACHED (git branch --show-current empty;  (full comment #1 in ## Notes)
### comment #1 [2026-10-15 17:40] @claude
ROOT CAUSE (stiletto-2349-68, 2026-10-15 18:05Z): the submodule checkout was DETACHED (git branch --show-current empty; a --pin checkout from the withdrawn job j-mv9odvo1 was never settled back onto main after the operator stop). land commits on the detached HEAD, then git.mjs push() runs 'git push origin main', which pushes the LOCAL main branch, still at 33f705fa, so git answers up-to-date in 3 s and syncPush reports ok. Every landing since is local-only: 378a0f6e (C1) and the train commit after it. Fix needed in the kit: (1) land refuses or reattaches when HEAD is not on repo.main (git symbolic-ref -q HEAD); (2) push HEAD:main or assert rev-parse main == HEAD before push; (3) landed only after ls-remote shows the sha. Operator recovery applied in the stiletto checkout: git branch -f main HEAD && git checkout main (fast-forward, no tree change); the next lane landing's push carries the stranded commits.
- [2026-10-15 18:01] (comment) @claude: fixed: push sends HEAD:refs/heads/<main> and confirms the remote holds HEAD via ls-remote (git.mjs push); landCommits re (full comment #2 in ## Notes)
### comment #2 [2026-10-15 18:01] @claude
fixed: push sends HEAD:refs/heads/<main> and confirms the remote holds HEAD via ls-remote (git.mjs push); landCommits reattaches a detached HEAD that descends from main or refuses (attachBranch). scripts/broker/detached-land.test.mjs with controls. Not done: settling a --pin checkout back onto main after withdraw/stop/crash is in pin.mjs, owned by the T515 writer; the land guard now makes a stray detached checkout harmless.
- [2026-10-15 18:01] (status) todo → review
