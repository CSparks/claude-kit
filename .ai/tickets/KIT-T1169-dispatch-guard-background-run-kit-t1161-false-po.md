---
id: KIT-T1169
title: dispatch-guard background-run (KIT-T1161) false positive: blocks a brief that pairs a foreground build (cargo test --no-run) with 'start the BUILT test exe in the background', because a test exe path (target/debug/deps/<name>-<hash>.exe) is only known after the build and the brief cannot name it
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-14T00:00:06Z
updated: 2026-11-14T00:10:17Z
---

## Description
Reported by the coordinator 2026-11-13: an orchestrator brief said build in the foreground (cargo test -p road-generator --test <name> --no-run), then start the BUILT test exe in the background with CARGO_MANIFEST_DIR set and end the turn: the sanctioned form, worded without a literal target/debug/<name>.exe. Fix: the guard accepts a brief that pairs a foreground build (--no-run or cargo build) with the built exe wording or a target/debug path pattern; it keeps refusing run cargo test in the background and a bare start it in the background. kit-bug

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] background-run accepts a foreground build paired with the built (test) exe; hooks/dispatch-background-run.test.mjs 22 passed, 3 failed before (bb4d1cb)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1161, KIT-T1062
Fixed bb4d1cb. hooks/dispatch-background-run.test.mjs 22 passed (3 failed before).

## History
- [2026-11-14 00:00] (created) bug — dispatch-guard background-run (KIT-T1161) false positive: blocks a brief that pairs a foreground build (cargo test --no-run) with 'start the BUILT test exe in the background', because a test exe path (target/debug/deps/<name>-<hash>.exe) is only known after the build and the brief cannot name it
- [2026-11-14 00:01] (landed) bb4d1cb dispatch-guard background-run: a brief that builds in the foreground and starts "the built test exe" in the background p
- [2026-11-14 00:09] (comment) criterion added: background-run accepts a foreground build paired with the built (test) exe; hooks/dispatch-background-run.test.mjs 22 passed, 3 failed before (bb4d1cb)
- [2026-11-14 00:09] (comment) ticked: background-run accepts a foreground build paired with the built (test) exe; hooks/dispatch-background-run.test.mjs 22 passed, 3 failed before (bb4d1cb)
- [2026-11-14 00:10] (status) todo → review
