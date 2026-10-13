---
id: KIT-T447
title: Excluded trees: registry `excluded` roots make the kit inert — every hook exits 0 via compat-run, cap/t/q refuse — first use D:/dev/the-commodore (IFD fleet, CDX-governed)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T17:48:23Z
updated: 2026-10-13T17:56:13Z
---

## Description
A machine-local registry key `excluded: [<absolute root>, ...]` makes the kit inert beneath each root, so a tree that runs its own workflow (first use: D:/dev/the-commodore, the CDX-governed IFD fleet root) is never touched by hooks, `q`, `cap` or `t`. No marker file is written into the excluded tree.
Per-project `enabledPlugins` cannot do this: it has no ancestor lookup, so nested repos escape it.

## Acceptance Criteria
- [x] Matcher: `hooks/lib/excluded-trees.mjs` is case-insensitive on win32, boundary-safe (sibling `the-commodore-two` not matched), fail-open
- [x] compat-run exits 0 silently for an excluded payload cwd, process cwd and tool_input.file_path; a control outside the tree still halts
- [x] `resolveStoreRoot` returns null under an excluded tree and `noStoreMessage` reports the exclusion
- [x] `cap`, `t` and `q` refuse under an excluded root with exit 2 and the "claude-kit is off under <root>" message
- [x] `hooks/excluded-trees.test.mjs` (19 tests) is in the `npm test` chain
- [x] Docs: README 4a, hooks/README, CLAUDE.global.md HOOK CONTRACT, private overlay section

## Plan
1. Add `hooks/lib/excluded-trees.mjs` and pass `excluded` through `readRegistry`.
2. Gate compat-run (every hook) and `resolveStoreRoot` (store resolution) on it.
3. Call `refuseIfExcluded` at entry of cap, t, q.
4. Test, document, register the-commodore in the live registry.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T272, KIT-T186, KIT-T288

## History
- [2026-10-13 17:48] (created) feature — Excluded trees: registry `excluded` roots make the kit inert — every hook exits 0 via compat-run, cap/t/q refuse — first use D:/dev/the-commodore (IFD fleet, CDX-governed)
- [2026-10-13 17:56] (status) todo → review
