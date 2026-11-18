---
id: KIT-T1392
title: commit-foreign gate (KIT-T407) judges 'git add -A <pathspec> <pathspec>' as a directory-wide add: in rapid-game, 'git add -A rust/world/rg-h
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T20:01:10Z
updated: 2026-11-18T20:47:14Z
fixed_commit: b9664f1c
---

## Description
commit-foreign gate (KIT-T407) judges 'git add -A <pathspec> <pathspec>' as a directory-wide add: in rapid-game, 'git add -A rust/world/rg-hydrology rust/world/rg-openworld && git commit -F <file>' was blocked listing target/broker/runs/*.json, paths outside both pathspecs. The gate should honour pathspecs after -A (needed to stage renames/deletions inside a crate folder).

kit-bug-shape: cap:bug:commit-foreign-gate-kit-t407-judges-git-add-a-pa:483eb371
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] git add -A/--all/-u/--update with pathspecs is judged by those paths only, and build output under target/ (node_modules, dist, build) is never listed as foreign (hooks/commit-foreign-newdir.test.mjs)

## Plan
1.

## Notes
Root cause: hooks/lib/commit-files.mjs read `-A`, `--all`, `-u` and `--update` as a whole-tree pathspec (`.`) wherever they stood, so `git add -A rust/world/rg-hydrology rust/world/rg-openworld` became `., rg-hydrology, rg-openworld` and the commit gate judged every untracked file of the checkout, target/broker/runs/*.json among them. Git limits those flags to the pathspecs that follow.

Fix: those flags widen an add to the whole tree only when no pathspec follows (a bare `git add -A`, `git add --update`); a literal `.` stays the whole tree. The KIT-T407 foreign-path check also drops build output (target/, node_modules/, dist/, build/: isGeneratedPath), which is a tool's, never another writer's work.

Second question: proposal filed as KIT-T1396 (not built), with the numbers from road-generator's run records for 2026-11-18: 54 cargo checks, median 80 s, 10 over 170 s, 1 over 400 s; 14 of 56 printed a build-budget queue line, 1 a cargo target-dir lock wait; up to 5 cargo runs at once. The run records do not carry the start delay itself, so the first step proposed is to measure it.

Tests: hooks/commit-foreign-newdir.test.mjs 27 passed (new: the -A/--all/-u/--update pathspec cases; an add -A of two own folders passes beside a foreign file elsewhere and a target/broker/runs file; a bare add -A still refuses the foreign source file and never names build output); commit-gate, commit-gate-git-call 29, commit-foreign-moves, -submodule, -subdir-cwd, -lockfile pass.

## History
- [2026-11-18 20:01] (created) bug — commit-foreign gate (KIT-T407) judges 'git add -A <pathspec> <pathspec>' as a directory-wide add: in rapid-game, 'git add -A rust/world/rg-h
- [2026-11-18 20:46] (status) todo → doing
- [2026-11-18 20:46] (comment) criterion added: git add -A/--all/-u/--update with pathspecs is judged by those paths only, and build output under target/ (node_modules, dist, build) is never listed as foreign (hooks/commit-foreign-newdir.test.mjs)
- [2026-11-18 20:46] (comment) ticked: git add -A/--all/-u/--update with pathspecs is judged by those paths only, and build output under target/ (node_modules, dist, build) is never listed as foreign (hooks/commit-foreign-newdir.test.mjs)
- [2026-11-18 20:46] (landed) b9664f1c commit-foreign: git add -A with pathspecs is judged by those paths only, and build output is never foreign; KIT-T1396 pr
- [2026-11-18 20:47] (status) doing → review
- [2026-11-18 20:47] (comment) runtime b9664f1c published
