---
id: KIT-T1363
title: PROCESS FAILURE: a submodule pin commit message named a framework sha (8cc52c79) that was not the sha the gitlink recorded (ae380fc2: anothe
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T01:28:46Z
updated: 2026-11-18T01:45:38Z
---

## Description
PROCESS FAILURE: a submodule pin commit message named a framework sha (8cc52c79) that was not the sha the gitlink recorded (ae380fc2: another writer committed in the submodule between my git log and my commit); the demo was pushed with a gitlink to a framework commit that was not yet on the framework remote until fixed (framework pushed to ae380fc2 afterwards). Root cause: the coordinator typed the pin sha from an earlier read instead of from the staged gitlink. Prevention wanted: a commit gate check for a gitlink commit: the message must cite the exact sha the commit records (git ls-tree) and the gate must refuse a gitlink whose commit is not on the submodule's remote (a pushed superproject must never point at an unpushed submodule commit)

kit-bug-shape: cap:bug:process-failure-a-submodule-pin-commit-message-n:6c41b11f
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] commit-gate (check-id pin-sha) refuses a commit that moves a submodule pointer when its message names no prefix (7+ hex) of the sha the gitlink records, read from the work-tree submodule HEAD for a pathspec, -a or same-command-add commit and from the index otherwise, and prints the recorded sha; a matching sha passes; a commit moving no pointer is unaffected (hooks/pin-sha-push.test.mjs)
- [x] upstream-gate (check-id push-pin) refuses a git push whose HEAD points a submodule at a commit no remote-tracking branch of the submodule contains, naming the submodule push to do first; a pushed pointer passes; a repo without submodules is unaffected (hooks/pin-sha-push.test.mjs)

## Plan
1.

## Notes
Built: hooks/lib/gitlinks.mjs (gitlink paths and the pins a tree, the index and a submodule checkout record), hooks/lib/pin-cite.mjs (commit-gate, check-id pin-sha), hooks/lib/push-pins.mjs (upstream-gate, check-id push-pin). Residual: the push check reads the submodule's remote-tracking branches, so a submodule pushed from another checkout and not fetched here reads as unpushed until fetched (the block says so); a submodule not checked out or with no remote is skipped. Existing tests whose pin commits named no sha were updated to name it (commit-submodule-pin, commit-cite-keys, commit-gate KIT-T418 case). Tests: pin-sha-push 11 passed; commit-submodule-pin 10; commit-cite-keys all pass (8); commit-gate all pass (42); commit-foreign-submodule 6; commit-foreign-subdir-cwd 4; upstream-gate 44; upstream-gate-pre-push 25; source-shell-gate-git-gaps 133; framework-pin 29; framework-pin-hooks 5; flush exit 0. model-tag 63/64 fails 'display: the fable alias' identically at HEAD 48a7a74d (pre-existing, untouched).

## History
- [2026-11-18 01:28] (created) bug — PROCESS FAILURE: a submodule pin commit message named a framework sha (8cc52c79) that was not the sha the gitlink recorded (ae380fc2: anothe
- [2026-11-18 01:45] (status) todo → doing
- [2026-11-18 01:45] (comment) criterion added: commit-gate (check-id pin-sha) refuses a commit that moves a submodule pointer when its message names no prefix (7+ hex) of the sha the gitlink records, read from the work-tree submodule HEAD for a pathspec, -a or same-command-add commit and from the index otherwise, and prints the recorded sha; a matching sha passes; a commit moving no pointer is unaffected (hooks/pin-sha-push.test.mjs)
- [2026-11-18 01:45] (comment) criterion added: upstream-gate (check-id push-pin) refuses a git push whose HEAD points a submodule at a commit no remote-tracking branch of the submodule contains, naming the submodule push to do first; a pushed pointer passes; a repo without submodules is unaffected (hooks/pin-sha-push.test.mjs)
- [2026-11-18 01:45] (comment) ticked: upstream-gate (check-id push-pin) refuses a git push whose HEAD points a submodule at a commit no remote-tracking branch of the submodule contains, naming the submodule push to do first; a pushed pointer passes; a repo without submodules is unaffected (hooks/pin-sha-push.test.mjs)
- [2026-11-18 01:46] (comment) ticked: pin-sha-push 11 passed
