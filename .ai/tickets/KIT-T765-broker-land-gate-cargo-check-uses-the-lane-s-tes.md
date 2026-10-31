---
id: KIT-T765
title: broker: land-gate cargo check uses the lane's test feature set; the extra-feature check runs on the suite schedule (KIT-Q005 lever 1, KIT-D121)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:18:10Z
updated: 2026-10-31T16:18:10Z
---

## Description
KIT-Q005 lever 1 option A (maintainer 2026-10-30), KIT-D121 waste: the land gate runs `cargo check` with the configured features and `cargo test` without, so every crate in the feature closure compiles twice per job (5294 s of 83217 s compile on dirt-empire, 914 jobs).

Fix: the gate check takes the feature set of `affected.test` (alias expanded); a check feature the tests do not use becomes a scheduled check that runs with the suite. Generic: derived in pipeline-config from the configured check and test prefix, no project special case.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T632, KIT-T681, KIT-T561
Evidence: gate-check 7, precheck/precheck-scope/-guards/-submodule/-missing-log, landgate*, suite/suite-nightly/lane-suite, autopin: 67 passed. Proof: gateChecks(check with --features dirt-empire/tools, test without) -> gate has no feature; with tests carrying the feature the gate is the identical feature set, so check then test share one compile. Precheck keeps the full check (own target dir).

## History
- [2026-10-31 16:18] (created) feature — broker: land-gate cargo check uses the lane's test feature set; the extra-feature check runs on the suite schedule (KIT-Q005 lever 1, KIT-D121)
