---
id: KIT-T423
title: Process failure (stiletto menus): framework-extraction work was scoped by what RENDERS, not by what OWNS THE BEHAVIOUR, and the one ticket o
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T16:34:52Z
updated: 2026-10-12T17:01:26Z
fixed_commit: 453fa17
---

## Description
Process failure (stiletto menus): framework-extraction work was scoped by what RENDERS, not by what OWNS THE BEHAVIOUR, and the one ticket ordering full extraction (ST-T283, 2026-08-17) sat todo for 2 months unnoticed. ST-T271/T272 (08-16/17) moved station menus' painting onto rg-ui paint::menu/grid but left game-local placement, pointer-to-row mapping, mount/teardown and input folding in stiletto crates/bay + hud/menu_kit, despite RG-D020/RG-D024/RG-D026/RG-D033 ('framework FIRST'). Frame/nav/scroll/lint/rg-screens landed 08-18 and no menu was revisited; dock/view.rs:136 and context/edit.rs:26 duplicate rg-screens read_input pointer maths. Cost surfaced 2026-10-10 (3aef5960 patched window reads in 17 game files). Root causes: (1) acceptance criteria named the render path, never 'no game-local host/pointer/mount code remains'; (2) nothing detects a game crate doing a job a framework crate also does (duplicate-concern) once the framework gains it; (3) extraction tickets aren't surfaced by drain/orient when the framework they wait on lands. Want: duplicate-concern detection (game vs framework) + extraction tickets that wake when their blocker lands.

kit-bug-shape: cap:bug:process-failure-stiletto-menus-framework-extract
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] scripts/concern-check.mjs reads primitives = [...] from <framework>/docs/CHOICES.toml (via frameworkRoots), searches the q code index for each in non-test game files (excludes the framework tree, *_tests.rs, tests/), prints concern "<name>" owned by <crate>; game does it locally in N files: <file:line ...> open tickets: <ids>; fails open on a missing map or field
- [x] orient prints a FRAMEWORK OWNS THIS block, at most 5 lines
- [x] fixture invariant test: a game file using a declared primitive is flagged; the same use under the framework tree, as *_tests.rs or under tests/ is not
- [ ] waits_on: frontmatter wakes an extraction ticket when its framework blocker lands (frameworkStores), listed in an orient DISPATCH NOW block
- [ ] triage tags extract/migrate tickets with concern:, and the closing evidence floor (commit-gate.mjs:263) runs concern-check for them

## Plan
1.

## Notes
- Design (opus analyst, 2026-10-12): declared ownership map. rapid-game/docs/CHOICES.toml concern rows gain primitives = [...] (rg-screens: RelativeCursorPosition, cursor_position(, Res<UiScale>); scripts/concern-check.mjs reads it via q-framework.mjs frameworkRoots():34 and searches the q code index for those primitives in non-test game files; runs in orient (5 lines max) and in the commit gate on a framework pin change. Why not code-graph duplicate-defines: git ls-files skips submodule contents (code-graph.mjs:162) and names differ (follow_mouse vs read_input). Later: waits_on: frontmatter that wakes tickets via frameworkStores (q-framework.mjs:16) in an orient DISPATCH NOW block (like asked-again.mjs:52); triage tags extract/migrate tickets with concern:, and the closing evidence floor (commit-gate.mjs:263) runs the check. FIRST SLICE: concern-check.mjs + orient block + fixture invariant test (flags a game file using a declared primitive, ignores rapid-game/** and *_tests.rs); seeding the rg-screens row is a separate rapid-game change.
### comment #1 [2026-10-12 17:00] @claude
First slice landed: scripts/concern-check.mjs + orient FRAMEWORK OWNS THIS block (<=5 lines) + scripts/concern-check.test.mjs (7 passed; failed with ERR_MODULE_NOT_FOUND before the script existed; mutation isGameFile->true fails 3). Kit suite: 93 suites, 1618 passed, 1 failed (activity-tag local-qwen tag, pre-existing since f64e051) + server.test.mjs cannot load express (env). Stiletto run: no findings, since no CHOICES.toml row declares primitives yet. NEXT STEP (separate rapid-game change, not done here): seed the rg-screens row in rapid-game/docs/CHOICES.toml with primitives = ["RelativeCursorPosition", "cursor_position(", "Res<UiScale>"]. Remaining criteria: waits_on wake-up, triage concern: tags + evidence floor.
### comment #2 [2026-10-12 18:02] @claude
2026-10-12: rg-screens row seeded (rapid-game b270184: primitives = ["RelativeCursorPosition", "cursor_position(", "Res<UiScale>"]). node scripts/concern-check.mjs from D:\dev\stiletto-2349 prints: concern "standard screens" owned by rg-screens; game does it locally in 17 files: crates/bay/src/context/edit.rs:6 crates/bay/src/context/view.rs:9 crates/bay/src/dock/panel.rs:9 crates/bay/src/dock/view.rs:9 crates/bay/src/harness.rs:168 crates/bay/src/inventory/mod.rs:115 crates/bay/src/inventory/view.rs:72 crates/bay/src/pointer.rs:1 crates/bay/src/refit/edit.rs:12 crates/bay/src/refit/hold.rs:80 crates/bay/src/refit/panel.rs:14 crates/bay/src/refit/view.rs:68 crates/bay/src/shop/mod.rs:149 crates/bay/src/shop/view.rs:54 crates/hud/src/enemy_health.rs:33 crates/hud/src/floaters_view.rs:91 crates/view/src/app/input.rs:194 open tickets: RG-T207 ST-T604 ST-T569

## History
- [2026-10-12 16:34] (created) bug — Process failure (stiletto menus): framework-extraction work was scoped by what RENDERS, not by what OWNS THE BEHAVIOUR, and the one ticket o
- [2026-10-12 17:00] (comment) criterion added: scripts/concern-check.mjs reads primitives = [...] from <framework>/docs/CHOICES.toml (via frameworkRoots), searches the q code index for each in non-test game files (excludes the framework tree, *_tests.rs, tests/), prints concern "<name>" owned by <crate>; game does it locally in N files: <file:line ...> open tickets: <ids>; fails open on a missing map or field
- [2026-10-12 17:00] (comment) criterion added: orient prints a FRAMEWORK OWNS THIS block, at most 5 lines
- [2026-10-12 17:00] (comment) criterion added: fixture invariant test: a game file using a declared primitive is flagged; the same use under the framework tree, as *_tests.rs or under tests/ is not
- [2026-10-12 17:00] (comment) criterion added: waits_on: frontmatter wakes an extraction ticket when its framework blocker lands (frameworkStores), listed in an orient DISPATCH NOW block
- [2026-10-12 17:00] (comment) criterion added: triage tags extract/migrate tickets with concern:, and the closing evidence floor (commit-gate.mjs:263) runs concern-check for them
- [2026-10-12 17:00] (comment) ticked: scripts/concern-check.mjs reads primitives = [...] from <framework>/docs/CHOICES.toml (via frameworkRoots), searches the q code index for each in non-test game files (excludes the framework tree, *_tests.rs, tests/), prints concern "<name>" owned by <crate>; game does it locally in N files: <file:line ...> open tickets: <ids>; fails open on a missing map or field
- [2026-10-12 17:00] (comment) ticked: fixture invariant test: a game file using a declared primitive is flagged; the same use under the framework tree, as *_tests.rs or under tests/ is not
- [2026-10-12 17:00] (comment) ticked: triage tags extract/migrate tickets with concern:, and the closing evidence floor (commit-gate.mjs:263) runs concern-check for them
- [2026-10-12 17:00] (comment) @claude: First slice landed: scripts/concern-check.mjs + orient FRAMEWORK OWNS THIS block (<=5 lines) + scripts/concern-check.tes (full comment #1 in ## Notes)
- [2026-10-12 17:00] (comment) unticked: triage tags extract/migrate tickets with concern:, and the closing evidence floor (commit-gate.mjs:263) runs concern-check for them
- [2026-10-12 17:00] (comment) ticked: orient prints a FRAMEWORK OWNS THIS block, at most 5 lines
- [2026-10-12 17:01] (status) todo → review
- [2026-10-12 17:01] (comment) first slice (fixed) 453fa17; concern-check.test.mjs 7 passed; remaining: waits_on + triage criteria
- [2026-10-12 18:02] (comment) @claude: 2026-10-12: rg-screens row seeded (rapid-game b270184: primitives = ["RelativeCursorPosition", "cursor_position(", "Res< (full comment #2 in ## Notes)
