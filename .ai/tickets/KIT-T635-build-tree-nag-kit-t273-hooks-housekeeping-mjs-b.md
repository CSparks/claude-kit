---
id: KIT-T635
title: Build-tree nag (KIT-T273, hooks/housekeeping.mjs buildTreeLine) only inspects <gitRoot>/target/debug of the session's repo. It is blind to t
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-23T22:53:31Z
updated: 2026-10-23T23:18:17Z
---

## Description
Build-tree nag (KIT-T273, hooks/housekeeping.mjs buildTreeLine) only inspects <gitRoot>/target/debug of the session's repo. It is blind to the rapid-game submodule build dir (<game>/rapid-game/rust/target - stiletto-2349's reached ~1 TB per maintainer, 57,756 deps entries + 3,564 orphaned incremental sessions on 2026-10-23), to sibling target-*/target-lanes/broker lane dirs (dirt-empire/target/de-t118 etc.), to .claude/worktree targets, and to every repo no session opened; it never fires for an unbounded D:\dev session. Root cause: the check is scoped to one repo's top-level target, while the waste lives in submodule + lane + worktree build dirs. Also process failure same session: a depth-4 find was presented as the full inventory and used to call the maintainer's 3.5 TB figure wrong - an inventory claim needs an unbounded search.

kit-bug-shape: cap:bug:build-tree-nag-kit-t273-hooks-housekeeping-mjs-b
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] SessionStart nag walks the whole current repo (submodule, lanes, worktrees) with the unbounded build-dir discovery shared with the sweep; counts first, bytes only after a count trips
- [x] SessionStart surfaces the sweep log's last receipt, and warns when the scheduled task is missing or not firing

## Plan
1.

## Notes
Tests: hooks/build-tree.test.mjs 11 asserts (depth-7 submodule target, lane dirs, 3-line cap, receipt/not-scheduled/not-firing lines); hooks/housekeeping.test.mjs 40 pass; npm test 119 of 247 files run, all ok. Unbounded (non-repo) sessions skip the walk (D:\dev walk is 4.8 s) and get the sweep status line only.

## History
- [2026-10-23 22:53] (created) bug — Build-tree nag (KIT-T273, hooks/housekeeping.mjs buildTreeLine) only inspects <gitRoot>/target/debug of the session's repo. It is blind to t
- [2026-10-23 23:18] (comment) criterion added: SessionStart nag walks the whole current repo (submodule, lanes, worktrees) with the unbounded build-dir discovery shared with the sweep; counts first, bytes only after a count trips
- [2026-10-23 23:18] (comment) criterion added: SessionStart surfaces the sweep log's last receipt, and warns when the scheduled task is missing or not firing
- [2026-10-23 23:18] (comment) ticked: SessionStart nag walks the whole current repo (submodule, lanes, worktrees) with the unbounded build-dir discovery shared with the sweep; counts first, bytes only after a count trips
- [2026-10-23 23:18] (comment) ticked: SessionStart surfaces the sweep log's last receipt, and warns when the scheduled task is missing or not firing
- [2026-10-23 23:18] (status) todo → review
- [2026-10-23 23:18] (landed) fb0cdb3 implements KIT-T635: SessionStart build-tree nag walks the whole repo and surfaces the sweep receipt / missing-task warn
