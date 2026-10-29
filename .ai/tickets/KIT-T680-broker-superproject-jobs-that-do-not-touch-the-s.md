---
id: KIT-T680
title: broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whene
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:04:34Z
updated: 2026-10-28T22:04:34Z
---

## Description
broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whenever the rapid-game lane holds the rapid-game tree; dirt-empire 2026-10-28 21:46-21:53 five game jobs waited behind one failing 7-min framework check). Snapshot the pinned submodule tree for the root lane instead of sharing the live one.

kit-bug-shape: cap:feature:broker-superproject-jobs-that-do-not-touch-the-s
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Diagnosis 2026-10-28 (dirt-empire logs): by design, not a bug. subtree.mjs usesTree() makes every root job that runs cargo (all game jobs: the workspace builds over rapid-game path crates) take the rapid-game tree lock (KIT-T517/T559/T561), held for the whole submodule-lane job incl. its pre-push gate. Root-lane daemon logged 47 'waiting - rapid-game tree' periods, ~139 min total today (~25 min since 20:00Z; longest 12 min). docs/BROKER.md claimed lanes do not block (that sentence is about the dispatch guard only) - corrected. Fix needs the root lane to build against a snapshot of the pinned submodule sha; design only, not built (maintainer withdrew DE-D058 redesign).
Design only, not built. Root jobs need the rapid-game tree because dirt-empire's Cargo path dependencies resolve into the live submodule working tree; cargo cannot be pointed at a snapshot without a second superproject tree (git worktree + submodule at the pinned sha, sharing the registry-crate part of target/), which is the broker-internal copy model the maintainer dropped on 2026-10-28. Cheaper options that do not need a copy: (a) shared/exclusive tree lock, root jobs shared while the submodule lane is idle between jobs, the lane's gate exclusive; (b) release the tree between the submodule lane's commands instead of for the whole job; (c) run the submodule lane's pre-push full gate at idle only (KIT-T561 item 3). Upper bound recovered: 139 min of root waiting on 2026-10-28 (25 min since 20:00Z).
Cheap-options assessment 2026-10-28 (dirt-empire results, nothing built, each option measured against the day's data): (a) release the tree between a submodule job's commands: unsafe and counter-productive. processPatch writes the patch into the live submodule tree before the first command and restores after the last, so between commands the tree holds uncommitted lane edits; a root build there compiles them, and restoring and re-applying between commands changes mtimes and rebuilds the touched crates. (b) pre-push full gate only at idle: moot here. dirt-empire's rapid-game repo has no pre_push, and the lane's 63 jobs spent 9311 of 10030 s in the run phase (apply 161, gate 173, commit 206, push 92); a repo that configures pre_push must pass its gate before the push by its own rule. (c) shared/exclusive lock: no gain, because root jobs run one at a time in one root daemon, so no two readers ever overlap, and the lane's run phase holds a patched tree, i.e. a write. Why the wait is mostly queueing, not a lock artefact: both lanes build with -j auto into one target dir under the machine build slot (one slot when -j fills the box), so un-locked concurrent builds would serialise on the slot anyway; root 532 command-min + rapid-game 147 command-min in the day; only 4 min of slot waiting was seen because the tree lock already serialised them. The one large item in the 139 min was the hung job (2074 s, now bounded by the KIT-T676 timeout, floor 600 s). Remaining real lever: only a second superproject tree with separate target dir would overlap work, and it would contend for the same cores.
Correction to the note above: the 2074 s hung job j-mvskowvb ran in the ROOT lane, so it blocked the rapid-game lane, not the reverse; it is not part of the 139 min of root waiting (longest root wait period 12 min). The timeout (KIT-T676) bounds that opposite-direction case.

## History
- [2026-10-28 22:04] (created) feature — broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whene
