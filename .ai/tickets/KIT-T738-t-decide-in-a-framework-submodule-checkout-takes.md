---
id: KIT-T738
title: t decide in a framework submodule checkout takes the parent game's key (MAR-D009 for rapid-game): resolveStoreRoot ignores a submodule named like a registered project
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T22:39:36Z
updated: 2026-10-30T22:39:57Z
---

## Description
A session in D:\dev\marblequest\rapid-game (the framework checked out as marblequest's submodule) ran `t decide`; it printed MAR-D009 and wrote D:\dev\marblequest\.ai\decisions\MAR-D009-rapid-game-is-a-convention-over-configuration-framework-and-game.md (marblequest's store, data repo projects/marblequest). `t move MAR-D009 D:\dev\marblequest\rapid-game` then refused: same store.

## Root cause
resolveStoreRoot (hooks/lib/unbounded.mjs) is the one resolver for t, cap, q, orient. It walks up from the cwd to the nearest dir with `.ai/config.yml`. The submodule checkout has none (its `.ai/decisions/RG-D177...` is a tracked leftover from rapid-game commit 0c9c3e98, no config.yml), so the walk reached the game and took its key. The registry maps rapid-game to D:/dev/stiletto-2349/rapid-game, a different checkout, so the submodule path never matched.

## Fix
hooks/lib/framework-store.mjs: when the nearest store lies above a git submodule checkout (a `.git` file with a gitdir under `modules/`) that is named like a registry project, resolveStoreRoot returns that project's store. A worktree, a plain nested repo, an unregistered submodule and a submodule with its own config.yml keep the nearest store. hooks/framework-store.test.mjs: 9 checks, 3 fail without the change.

## Repair
MAR-D009 moved to the rapid-game store as RG-D204 with `t move` (aka MAR-D009; the marblequest file stays as a superseded pointer, moved_to RG-D204). The `rapid-game/.ai/decisions/RG-D177...` dir in the submodule is tracked at rapid-game HEAD (commit 0c9c3e98), not a stray; left in place, since deleting it dirties rapid-game.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A cwd inside a registered framework's submodule checkout resolves to the framework's store (framework-store.test.mjs)
- [x] Controls keep the nearest store: unregistered submodule, worktree, nested repo, submodule with its own store
- [x] MAR-D009 lives in the rapid-game store as RG-D204 with a pointer left behind

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T268, KIT-T067
Tests: hooks/framework-store.test.mjs 9 passed (3 fail without the change); excluded-trees 19 and scripts/unbounded.test.mjs 31 still pass. Live: resolveStoreRoot from D:/dev/marblequest/rapid-game now returns D:/dev/stiletto-2349/rapid-game (its .ai is the rapid-game store). RG-D204 holds the moved decision.

## History
- [2026-10-30 22:39] (created) bug — t decide in a framework submodule checkout takes the parent game's key (MAR-D009 for rapid-game): resolveStoreRoot ignores a submodule named like a registered project
- [2026-10-30 22:39] (status) todo → review
