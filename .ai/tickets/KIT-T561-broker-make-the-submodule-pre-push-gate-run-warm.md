---
id: KIT-T561
title: broker: make the submodule pre-push gate run warm and move the full workspace run to idle (Chris approved 2026-10-17). (1) A landing job's c
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T21:53:12Z
updated: 2026-10-18T02:32:15Z
---

## Description
broker: make the submodule pre-push gate run warm and move the full workspace run to idle (Chris approved 2026-10-17). (1) A landing job's check builds the test binaries the gate will run: cargo t --no-run over the changed crates' reverse deps (same command shape as the gate's changed lane, rapid-game scripts/gate/pre-push.mjs plan), so the gate compiles nothing (RG-T234 evidence: gate compiled ~41 integration-test exes the check never built, 6m54s). (2) Never run another lane's cargo in the shared target dir while a lane's pre-push gate runs (gate log: Blocking waiting for file lock on artifact directory, stiletto cargo t 7m12s overlapping). (3) A per-lane suite entry so the rapid-game full workspace run (npm run check:all with RG_GATE=full) runs at idle and files a regression naming the causing commit.

Checked as possible duplicates and judged different work (--not-dup): KIT-T553, KIT-T545

kit-bug-shape: cap:feature:broker-make-the-submodule-pre-push-gate-run-warm
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built in the kit: prebuild.mjs (gate_prebuild: a landing that reaches a crate builds the gate's test binaries once per train; prebuild.test.mjs 4), gate-exclusive.test.mjs (the gate runs under the lane tree lock, so a root cargo job cannot share the target dir and idle work yields; 1), per-lane suite in suite.mjs (repo suite: key, filing a regression naming the range's landings on red, cancelled by a queued job in any lane; lane-suite.test.mjs 2), autopin.mjs (auto_pin consumers, pin-only jobs through each consumer's own submit, red pin files a bug there; autopin.test.mjs 4). Also fixed: a lane suite cancelled by ANOTHER lane's job no longer recurses forever in processOnce; parsePins fetches a missing commit for a landing. Stiletto/dirt-empire config.yml still needs gate_prebuild, suite and auto_pin on their rapid-game entries. Pre-push phase NOT measured: needs a landing on the published runtime.

## History
- [2026-10-17 21:53] (created) feature — broker: make the submodule pre-push gate run warm and move the full workspace run to idle (Chris approved 2026-10-17). (1) A landing job's c
- [2026-10-18 02:32] (status) todo → review
