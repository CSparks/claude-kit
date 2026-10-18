---
id: KIT-T563
title: Auto-pin every consumer on each rapid-game landing (Chris 2026-10-17 questionnaire: 'Auto-pin both on every landing'). When a rapid-game com
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-18T00:59:47Z
updated: 2026-10-18T02:32:20Z
---

## Description
Auto-pin every consumer on each rapid-game landing (Chris 2026-10-17 questionnaire: 'Auto-pin both on every landing'). When a rapid-game commit reaches origin/main, every registered checkout whose superproject pins rapid-game (stiletto-2349, dirt-empire; machine registry) queues a pin job in its OWN broker; no checkout waits on another (KIT-D097). A red pin keeps the old gitlink, files a ticket in that repo naming the break, and never blocks the other consumer. Pin jobs need no smuggled op (KIT-T562). Test: one landing -> one pin job per consumer; a red consumer leaves the other pinned.

kit-bug-shape: cap:feature:auto-pin-every-consumer-on-each-rapid-game-landi
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built in the kit: prebuild.mjs (gate_prebuild: a landing that reaches a crate builds the gate's test binaries once per train; prebuild.test.mjs 4), gate-exclusive.test.mjs (the gate runs under the lane tree lock, so a root cargo job cannot share the target dir and idle work yields; 1), per-lane suite in suite.mjs (repo suite: key, filing a regression naming the range's landings on red, cancelled by a queued job in any lane; lane-suite.test.mjs 2), autopin.mjs (auto_pin consumers, pin-only jobs through each consumer's own submit, red pin files a bug there; autopin.test.mjs 4). Also fixed: a lane suite cancelled by ANOTHER lane's job no longer recurses forever in processOnce; parsePins fetches a missing commit for a landing. Stiletto/dirt-empire config.yml still needs gate_prebuild, suite and auto_pin on their rapid-game entries. Pre-push phase NOT measured: needs a landing on the published runtime.

## History
- [2026-10-18 00:59] (created) feature — Auto-pin every consumer on each rapid-game landing (Chris 2026-10-17 questionnaire: 'Auto-pin both on every landing'). When a rapid-game com
- [2026-10-18 02:32] (status) todo → review
