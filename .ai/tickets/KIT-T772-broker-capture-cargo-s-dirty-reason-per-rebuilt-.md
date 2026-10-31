---
id: KIT-T772
title: broker: capture cargo's dirty reason per rebuilt crate and rank the top reasons per crate in broker blockers (KIT-Q005 lever 3, KIT-D121)
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-D121]
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:44:23Z
updated: 2026-10-31T16:57:35Z
---

## Description
KIT-Q005 resolution (3): a live cargo probe names the dirty reason before any second check tree (KIT-D039, KIT-D104: no scratch copy, no second target dir). The broker runs its cargo commands with CARGO_LOG=cargo::core::compiler::fingerprint=info; timing-waste parses each rebuilt crate's reason into the timing record; broker blockers shows the top reasons per crate; raw lines dropped after parsing.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T765, KIT-T729, KIT-T649, KIT-T571
Built: fingerprint-log.mjs (CARGO_LOG=cargo::core::compiler::fingerprint=info for every broker command via run.mjs and run-cancellable.mjs; parseFingerprint/harvestDirty turn cargo's dirty lines into command.dirty [{crate, reason, count}] and drop the raw lines from the log), timing-waste.mjs 'dirty' entries '<crate>: <reason>' for each unneeded rebuild or repeat, timing-dirty.mjs + timing-report.mjs print the top reasons per crate in 'broker blockers'. Not ticketed: dirty is a data kind like flagged. Parser tested on verbatim cargo 1.94.1 lines from a throwaway two-crate workspace (scripts/broker/fixtures/fingerprint-{changed,rustflags,cold}.log). Real run via runCommand on the throwaway crate: dirty = probe 'dependency rebuilt', depc 'source changed: dep/src/lib.rs'; the 353-byte log keeps no fingerprint line. Evidence: fingerprint-log 6, timing-dirty 4, timing-* 39 total, run/baseline/patch 24 passed. Takes effect on new jobs; old results have no dirty field and record none.

## History
- [2026-10-31 16:44] (created) feature — broker: capture cargo's dirty reason per rebuilt crate and rank the top reasons per crate in broker blockers (KIT-Q005 lever 3, KIT-D121)
- [2026-10-31 16:44] (status) todo → doing
- [2026-10-31 16:57] (status) doing → review
