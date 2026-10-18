---
id: KIT-T559
title: broker: rapid-game gate scope: the submodule pre-push gate covers only changed crates plus reverse dependencies, and the full workspace run moves to the idle suite cadence, which files a regression naming the causing commit
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T20:39:25Z
updated: 2026-10-18T02:32:11Z
---

## Description
Chris 2026-10-17 questionnaire answer 1, second half. Not built in T553: the scoped gate lives in rapid-game's pre-push hook and the idle-cadence regression filing is a suite.mjs change; needs its own agent.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T535, KIT-T482, KIT-T545, KIT-T553
Built in the kit: prebuild.mjs (gate_prebuild: a landing that reaches a crate builds the gate's test binaries once per train; prebuild.test.mjs 4), gate-exclusive.test.mjs (the gate runs under the lane tree lock, so a root cargo job cannot share the target dir and idle work yields; 1), per-lane suite in suite.mjs (repo suite: key, filing a regression naming the range's landings on red, cancelled by a queued job in any lane; lane-suite.test.mjs 2), autopin.mjs (auto_pin consumers, pin-only jobs through each consumer's own submit, red pin files a bug there; autopin.test.mjs 4). Also fixed: a lane suite cancelled by ANOTHER lane's job no longer recurses forever in processOnce; parsePins fetches a missing commit for a landing. Stiletto/dirt-empire config.yml still needs gate_prebuild, suite and auto_pin on their rapid-game entries. Pre-push phase NOT measured: needs a landing on the published runtime.

## History
- [2026-10-17 20:39] (created) feature — broker: rapid-game gate scope: the submodule pre-push gate covers only changed crates plus reverse dependencies, and the full workspace run moves to the idle suite cadence, which files a regression naming the causing commit
- [2026-10-18 02:32] (status) todo → review
