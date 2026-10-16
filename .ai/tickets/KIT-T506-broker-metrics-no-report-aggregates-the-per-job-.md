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
### comment #3 [2026-10-16 14:58] @claude
Vetting 2026-10-16: stats print wrong numbers. D5 stats.mjs:28 drops results without startedAt; a 'superseded' write replaced a 'passed' the daemon logged 2 s later (mva6u8uh ~44 min of commands, mv9q1h48 ~23 min); dropped jobs (target/broker/dropped/) leave no result so the two costliest faults (mv9y8xb8 ~52 min, mv9odvo1 ~26 min) are invisible. D6 metrics.mjs:104 BUILD regex never matches (compile is inside cargo test; 91% of command minutes are 'Finished test profile ... in Xs'); metrics.mjs:127,:133 count a train's shared commands and gate once per member (deduped test 160.1 min not 382.2, gate 203.2 not 331.5). D6b ST-T904 baseline singleS = median over all solo jobs in every lane (metrics.mjs:162-163) = 86.6 s, set by fast reds; fair = per lane, per job, warm command time plus land phases, failed jobs excluded. Fixing in this order.

## History
- [2026-10-15 14:40] (created) feature — Broker metrics: no report aggregates the per-job results. target/broker/results/*.json carry submit time (job id), startedAt/finishedAt and per-phase timings (09e1cc2), but queue wait, build/test/gate minutes, fail and red rates, batch sizes, per-session fairness and stall kills are only computed by hand (analyst forensics KIT-T482#3, ST-T904 by hand). Needs a broker stats command plus a daily rollup line in orient, measured against the ST-T904 targets (wait <= 1.5x single-job time)
- [2026-10-15 14:40] (comment) @claude: Chris 2026-10-15 verbatim: 'Are we keeping metrics on how well the new KIT broker is running?' Answer at filing: raw per (full comment #1 in ## Notes)
- [2026-10-15 15:04] (comment) @claude: fixed in this commit: tests broker suite 241+ passed (npm test exit 0); testkit-leak.test.mjs / hydrate-sources.test.mjs / metrics.test.mjs / suite-starve.test.mjs / stop.test.mjs added with controls
- [2026-10-15 15:04] (status) todo → review
- [2026-10-16 14:58] (comment) @claude: Vetting 2026-10-16: stats print wrong numbers. D5 stats.mjs:28 drops results without startedAt; a 'superseded' write rep (full comment #3 in ## Notes)
