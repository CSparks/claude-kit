---
id: KIT-T284
title: Tree-based documentation: docs mirror the code tree — each concern folder/crate carries a short header doc (what it is, entry points), a generated index walks the tree, every doc is reachable from the tree, orphan and duplicate docs are flagged — so finding things is navigation, not grepping
type: feature
status: doing
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:08:22Z
updated: 2026-10-02T15:21:37Z
---

## Description
Library scripts/doc-tree.mjs (+ scripts/tree-walk.mjs): units = repo root, manifest dirs, concern folders (source dirs under a unit or its src/lib); header doc = README.md, trunk cap 80 lines, branch cap 60; generated index docs/TREE.md; lint rules missing-header, header-too-long, header-no-purpose, duplicate-doc, orphan-doc, missing-index, stale-index; CLI index/lint/map. Adoption = docs/TREE.md exists; the three hook gates key off it (hooks/lib/doc-tree-gates.mjs): pre-write blocks a NEW crate/concern folder without README.md, commit-gate blocks add/move/rename/delete of source without a header doc or index change and blocks a stale index, orient prints the trunk map; check-id doc-tree via .claude-kit-ignore.yaml. Also fixed: pre-write now canonicalises the path so a write that creates its own directory still finds the git root. Gaps measured read-only 2026-10-02 (no files written into those trees): stiletto 52 folders without header, 76 orphan docs, 2 oversized headers, no index; rapid-game 177 folders without header, 26 orphan docs, 1 duplicate, no index. Tests: scripts/doc-tree.test.mjs (11), hooks/doc-tree-gates.test.mjs (19). Criterion 5 (weekly review) lands with KIT-T281.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Generated docs index from the code tree (one entry per crate/concern folder with its one-line purpose)
- [x] Lint: concern folders without a header doc, docs not reachable from the index, two docs covering one concern
- [x] Applied first to rapid-game and stiletto with the gaps listed
- [x] Cascading context (Chris 2026-10-02): the doc tree is separated by concern and read top-down — the trunk doc is a short map naming each concern and where it lives, each level adds only its own scope and points down, so an agent builds context by descending only the branch it needs instead of reading a novel at the trunk. Size cap per level asserted by the lint
- [ ] Standing rule (Chris 2026-10-02): every code repo always has a solid doc tree saying what everything does and where it lives; kept current as part of the weekly review (KIT-T281) and checked on landing
- [x] Enforced by hooks, not judgement (Chris 2026-10-02): (a) pre-write gate blocks creating a new crate/concern folder without its header doc; (b) commit gate blocks a commit that adds, moves, renames or deletes source files/folders without the doc tree (header docs + generated index) updated in the same commit; (c) orient prints the trunk map at SessionStart so agents navigate the tree first; standard exclusion surfaces, tests per gate

## Plan
1.

## History
- [2026-10-02 15:08] (created) feature — Tree-based documentation: docs mirror the code tree — each concern folder/crate carries a short header doc (what it is, entry points), a generated index walks the tree, every doc is reachable from the tree, orphan and duplicate docs are flagged — so finding things is navigation, not grepping
- [2026-10-02 15:08] (comment) criterion added: Generated docs index from the code tree (one entry per crate/concern folder with its one-line purpose)
- [2026-10-02 15:08] (comment) criterion added: Lint: concern folders without a header doc, docs not reachable from the index, two docs covering one concern
- [2026-10-02 15:08] (comment) criterion added: Applied first to rapid-game and stiletto with the gaps listed
- [2026-10-02 15:08] (comment) criterion added: Cascading context (Chris 2026-10-02): the doc tree is separated by concern and read top-down — the trunk doc is a short map naming each concern and where it lives, each level adds only its own scope and points down, so an agent builds context by descending only the branch it needs instead of reading a novel at the trunk. Size cap per level asserted by the lint
- [2026-10-02 15:08] (comment) criterion added: Standing rule (Chris 2026-10-02): every code repo always has a solid doc tree saying what everything does and where it lives; kept current as part of the weekly review (KIT-T281) and checked on landing
- [2026-10-02 15:09] (comment) criterion added: Enforced by hooks, not judgement (Chris 2026-10-02): (a) pre-write gate blocks creating a new crate/concern folder without its header doc; (b) commit gate blocks a commit that adds, moves, renames or deletes source files/folders without the doc tree (header docs + generated index) updated in the same commit; (c) orient prints the trunk map at SessionStart so agents navigate the tree first; standard exclusion surfaces, tests per gate
- [2026-10-02 15:21] (comment) ticked: Generated docs index from the code tree (one entry per crate/concern folder with its one-line purpose)
- [2026-10-02 15:21] (comment) ticked: Applied first to rapid-game and stiletto with the gaps listed
- [2026-10-02 15:21] (comment) ticked: Standing rule (Chris 2026-10-02): every code repo always has a solid doc tree saying what everything does and where it lives; kept current as part of the weekly review (KIT-T281) and checked on landing
- [2026-10-02 15:21] (status) todo → doing
- [2026-10-02 15:21] (comment) unticked: Standing rule (Chris 2026-10-02): every code repo always has a solid doc tree saying what everything does and where it lives; kept current as part of the weekly review (KIT-T281) and checked on landing
- [2026-10-02 15:21] (comment) ticked: Lint: concern folders without a header doc, docs not reachable from the index, two docs covering one concern
- [2026-10-02 15:21] (comment) ticked: Cascading context (Chris 2026-10-02): the doc tree is separated by concern and read top-down — the trunk doc is a short map naming each concern and where it lives, each level adds only its own scope and points down, so an agent builds context by descending only the branch it needs instead of reading a novel at the trunk. Size cap per level asserted by the lint
- [2026-10-02 15:21] (comment) ticked: Enforced by hooks, not judgement (Chris 2026-10-02): (a) pre-write gate blocks creating a new crate/concern folder without its header doc; (b) commit gate blocks a commit that adds, moves, renames or deletes source files/folders without the doc tree (header docs + generated index) updated in the same commit; (c) orient prints the trunk map at SessionStart so agents navigate the tree first; standard exclusion surfaces, tests per gate
