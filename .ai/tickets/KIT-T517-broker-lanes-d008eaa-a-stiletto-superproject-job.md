---
id: KIT-T517
title: broker lanes (d008eaa): a stiletto (superproject) job fails at phase pin with 'rapid-game sits at 30c0b81b but stiletto pins 33f705fa, and r
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:16:37Z
updated: 2026-10-16T20:52:29Z
fixed_commit: 56e2b14
---

## Description
broker lanes (d008eaa): a stiletto (superproject) job fails at phase pin with 'rapid-game sits at 30c0b81b but stiletto pins 33f705fa, and rapid-game has uncommitted changes' while the rapid-game lane has a job mid-run on the same submodule checkout (j-mv9rcgjp 17:14:28Z, 2 s after the lane daemon started). The two lanes share one submodule working tree: a superproject job that needs the submodule at its gitlink must wait for the rapid-game lane to be idle (or the lane must hand the tree over between jobs), never fail the job. Also: after the previous stiletto daemon re-ran a withdrawn --pin job, the submodule was left at the pinned sha (30c0b81b) instead of the recorded gitlink (33f705fa); a lane start should reconcile the submodule to the gitlink when the tree is clean

kit-bug-shape: cap:bug:broker-lanes-d008eaa-a-stiletto-superproject-job
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 17:16] (created) bug — broker lanes (d008eaa): a stiletto (superproject) job fails at phase pin with 'rapid-game sits at 30c0b81b but stiletto pins 33f705fa, and r
- [2026-10-16 19:43] (comment) @claude: WORSE SYMPTOM on runtime a671b7d (stiletto-2349-2a, 2026-10-16 round 12): the root job no longer fails at pin, it RUNS a (full comment #1 in ## Notes)
### comment #1 [2026-10-16 19:43] @claude
WORSE SYMPTOM on runtime a671b7d (stiletto-2349-2a, 2026-10-16 round 12): the root job no longer fails at pin, it RUNS against the lane's mid-job submodule tree. Stiletto land j-mvbd9ek7-h0j1ju (--pin rapid-game=e9cae518) ran 19:34:29-19:41:57Z while the rg lane held j-mvbd6g9r-5nz65b (RG-T213) in its pre-push gate with commit 2b3e7ab5 on the submodule HEAD. The land rebuilt 27 crates incl. rg-graphics rg-screens rg-probe-kit rg-shader-kit rg-tool-asset-editor (D:/dev/stiletto-2349/target/broker/logs/j-mvbd9ek7-h0j1ju-0.log); its check twin j-mvbd0zjb-0wgaub on e9cae518 rebuilt 14 game crates only. So the landed pin 66df89be (gitlink e9cae518) was tested against rg 2b3e7ab5: test evidence does not match the landed tree. Same cause missed the green cache (tree state differs) and cost a second build (3m31s + 214 s tests). Expected: a root job that pins or builds the submodule waits for the lane to release the submodule tree, or runs on a tree at the pinned sha; never on another lane's unpushed state. Correctness: raise above perf items.
- [2026-10-16 20:52] (comment) @claude: fixed 56e2b14: scripts/broker/subtree.mjs is a lock both lanes take (target/broker/subtree/<submodule>.lock, with the ho (full comment #2 in ## Notes)
### comment #2 [2026-10-16 20:52] @claude
fixed 56e2b14: scripts/broker/subtree.mjs is a lock both lanes take (target/broker/subtree/<submodule>.lock, with the holder's lane, job, pid and, for a superproject holder, the submodule's prior branch/sha). queue.mjs takes it per job (or train) before any pin checkout or tree write: the submodule lane always, a superproject job when it pins the submodule, edits a path in it, or runs cargo; idle re-checks and the suite take it too. A lane that finds it held leaves a want mark; the holder's lane yields to a fresh want instead of retaking it, so neither starves. The waiting job stays queued and the daemon logs 'waiting'. Evidence: scripts/broker/subtree.test.mjs, 8 passed; the superproject-waits and lane-waits tests ran the other lane as a second process (subtree-drive.mjs) and were red before (processed=1 instead of 0 queued=1); control: a superproject job that touches neither pins nor cargo runs beside a lane job. broker glob 324 passed.
- [2026-10-16 20:52] (status) todo → review
- [2026-10-16 20:52] (comment) subtree.test.mjs 8 passed, broker glob 324 passed
- [2026-10-16 21:54] (comment) @claude: reconcile built: the submodule lane's takeSubtrees calls reattachBranch before a non-idle job: a clean tree detached at  (full comment #3 in ## Notes)
### comment #3 [2026-10-16 21:54] @claude
reconcile built: the submodule lane's takeSubtrees calls reattachBranch before a non-idle job: a clean tree detached at an ancestor of the lane branch is checked out onto the branch (no ref moves), logging 'broker: <sub> was detached at <sha>; back on main before <job>'. Refused and left as found: dirty tree, HEAD not an ancestor (ahead/diverged), already on a branch; a superproject lane never reattaches. Evidence: scripts/broker/reattach.test.mjs 4 passed, the live case (stale base, land failing 'HEAD is detached and does not descend from main') red before; broker glob 340 passed.
