---
id: KIT-T632
title: kit-feature: broker nightly runs. Stiletto (ST-D255, ST-T926) now keeps two nextest profiles off the push wall that must run once a day: 'ca
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-22T21:05:49Z
updated: 2026-10-22T21:05:49Z
---

## Description
kit-feature: broker nightly runs. Stiletto (ST-D255, ST-T926) now keeps two nextest profiles off the push wall that must run once a day: 'cargo t -P render -j 1' (GPU pixel tier, one test at a time: gpu_serial is process-local) and 'cargo t -P perf -j 4' (slow headless tests, a fixed width so timings compare night to night), each followed by 'node scripts/test-timings.mjs record <profile>' which appends per-test seconds from target/nextest/<profile>/junit.xml to docs/perf/nightly/<profile>.jsonl. The broker has only the landing-count suite cadence (suite.mjs, suite_every), no time-based schedule. Wanted: a per-repo 'nightly:' list in broker config, run once per day when every lane is idle (yielding to queued jobs like the suite), never as a landing gate; keep an explicit -j in the command (composeCommand must not apply parallelism.test_threads over it); commit the recorded timing files through the broker as writer; file a red run as one regression like the suite does, without thresholds on time.

kit-bug-shape: cap:feature:kit-feature-broker-nightly-runs-stiletto-st-d255
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-22 21:05] (created) feature — kit-feature: broker nightly runs. Stiletto (ST-D255, ST-T926) now keeps two nextest profiles off the push wall that must run once a day: 'ca
