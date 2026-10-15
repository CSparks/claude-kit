---
id: KIT-T506
title: Broker metrics: no report aggregates the per-job results. target/broker/results/*.json carry submit time (job id), startedAt/finishedAt and per-phase timings (09e1cc2), but queue wait, build/test/gate minutes, fail and red rates, batch sizes, per-session fairness and stall kills are only computed by hand (analyst forensics KIT-T482#3, ST-T904 by hand). Needs a broker stats command plus a daily rollup line in orient, measured against the ST-T904 targets (wait <= 1.5x single-job time)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T14:40:04Z
updated: 2026-10-15T15:04:52Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T482, KIT-T490, KIT-T491
### comment #1 [2026-10-15 14:40] @claude
Chris 2026-10-15 verbatim: 'Are we keeping metrics on how well the new KIT broker is running?' Answer at filing: raw per-job data yes (269 results in stiletto target/broker/results), aggregate metrics no.

## History
- [2026-10-15 14:40] (created) feature — Broker metrics: no report aggregates the per-job results. target/broker/results/*.json carry submit time (job id), startedAt/finishedAt and per-phase timings (09e1cc2), but queue wait, build/test/gate minutes, fail and red rates, batch sizes, per-session fairness and stall kills are only computed by hand (analyst forensics KIT-T482#3, ST-T904 by hand). Needs a broker stats command plus a daily rollup line in orient, measured against the ST-T904 targets (wait <= 1.5x single-job time)
- [2026-10-15 14:40] (comment) @claude: Chris 2026-10-15 verbatim: 'Are we keeping metrics on how well the new KIT broker is running?' Answer at filing: raw per (full comment #1 in ## Notes)
- [2026-10-15 15:04] (comment) @claude: fixed in this commit: tests broker suite 241+ passed (npm test exit 0); testkit-leak.test.mjs / hydrate-sources.test.mjs / metrics.test.mjs / suite-starve.test.mjs / stop.test.mjs added with controls
- [2026-10-15 15:04] (status) todo → review
