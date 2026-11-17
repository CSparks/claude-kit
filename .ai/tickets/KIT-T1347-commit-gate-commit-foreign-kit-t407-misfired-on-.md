---
id: KIT-T1347
title: commit gate (commit-foreign, KIT-T407) misfired on a submodule commit: run from D:/dev/road-generator/rapid-game (its own repo, empty index)
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T19:18:48Z
updated: 2026-11-17T19:18:48Z
---

## Description
commit gate (commit-foreign, KIT-T407) misfired on a submodule commit: run from D:/dev/road-generator/rapid-game (its own repo, empty index) with git add -- <files> && git commit -F <file>, it listed 6 target/broker/* paths that belong to the outer superproject and blocked; it passed only after adding the explicit pathspec after -- on git commit. The gate should judge the repo the command runs in, not the superproject.

kit-bug-shape: cap:bug:commit-gate-commit-foreign-kit-t407-misfired-on-:5ac657a8
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: commit-gate and stdin.mjs started the target-repo walk at the hook process cwd (the session project root), not the payload cwd (the shell's directory), so a commit run inside a submodule with no cd or -C was judged against the superproject index. Fix: hooks/lib/shell-cwd.mjs payloadStartDir(p) (payload cwd when a directory, else process cwd) used by commit-gate.mjs and stdin.mjs. Test: hooks/commit-foreign-subdir-cwd.test.mjs (4 passed); regressions commit-gate 42, commit-foreign-submodule 6, commit-submodule-pin 6, commit-foreign-newdir 24, commit-foreign-moves 9, commit-agent-claims 14, shell-writes 15.

## History
- [2026-11-17 19:18] (created) bug — commit gate (commit-foreign, KIT-T407) misfired on a submodule commit: run from D:/dev/road-generator/rapid-game (its own repo, empty index)
