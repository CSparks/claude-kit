---
id: KIT-T1264
title: source-shell-write (KIT-T706) misattributes a concurrent writer's file: road-generator fences agent ran only a prebuilt test exe (town_rules
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T16:40:00Z
updated: 2026-11-15T17:17:32Z
---

## Description
source-shell-write (KIT-T706) misattributes a concurrent writer's file: road-generator fences agent ran only a prebuilt test exe (town_rules_census) and the PostToolUse hook flagged crates/rdg-scenery/src/flora_rows.rs, changed meanwhile by the flora agent through Edit; the check diffs the tree around a long shell call and blames whoever ran it. Needs per-writer attribution (write ledger) before flagging.

kit-bug-shape: cap:bug:source-shell-write-kit-t706-misattributes-a-conc:917f28d3
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in ef44f7d (runtime ef44f7d). Cause, not the ledger: the ledger had the flora agent Edit of flora_rows.rs (pred 16:35:05.242, confirmed 16:35:06.969 UTC, writer a4d235ef) and the fences call (a3afb01d, 16:37 to 16:39) ran target/debug/deps/town_rules_census-<hash>.exe. inert-command.mjs BUILT_EXE accepted a built program only DIRECTLY under target/<profile>/ (target/debug/probe.exe) and not under deps/ (cargo test exes) or examples/, so the call was not recognised as one that cannot write source and every changed source file was blamed on it. Fixed: one optional deps/ or examples/ component after the profile directory. Controls that stay blamed: a deps or examples exe redirected into a source file, a deps directory outside target/, a deps/nested/ path, node on a script under target/debug/deps. The Edit-ledger path was checked and is sound for this file (single Edit, confirmed). Observation, not fixed and not this ticket: flora_rows.rs content later differs from the one confirmed Edit hash with no ledger entry (a formatter or other unrecorded writer), which the ledger cannot attribute. Tests: hooks/shell-attribution.test.mjs 73 passed (one earlier run lost the timing-sensitive KIT-T1010 control under machine load, the rerun passed), hand-write-detect 73, hand-write-edit-sequences 14, tool-writes-race 8, hand-write-restore 27 passed 2 failed (the two pre-existing KIT-T982 controls, unchanged).

## History
- [2026-11-15 16:40] (created) bug — source-shell-write (KIT-T706) misattributes a concurrent writer's file: road-generator fences agent ran only a prebuilt test exe (town_rules
- [2026-11-15 17:13] (landed) ef44f7d A prebuilt test exe under target/<profile>/deps and an example under target/<profile>/examples are built programs like t
- [2026-11-15 17:17] (status) todo → review
