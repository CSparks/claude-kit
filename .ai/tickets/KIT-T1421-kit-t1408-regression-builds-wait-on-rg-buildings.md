---
id: KIT-T1421
title: KIT-T1408 regression: builds --wait on rg-buildings/src/relief.rs said 'once the batch's first edit passes, the hold lasts until the batch h
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T01:58:01Z
updated: 2026-11-19T02:26:42Z
---

## Description
KIT-T1408 regression: builds --wait on rg-buildings/src/relief.rs said 'once the batch's first edit passes, the hold lasts until the batch has landed, at most 120s', two relief.rs edits landed, then writer a114b672d9eabc0b8's 'cargo test -j 4 -p road-generator --test roads_group' (pid 54632) started 3 s later and the guard refused the batch's next edits (kinds.rs, model/projections.rs) as compiling. The batch hold does not stop a new build of a dependent crate (road-generator -> rg-buildings) from starting.

kit-bug-shape: cap:bug:kit-t1408-regression-builds-wait-on-rg-buildings:b517e014
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not an old-runtime problem: the session's hooks load the sealed current runtime (the live window file carries batchStart, written only by the KIT-T1408 code; refusal texts are current). The dependency-closure scope worked: at 01:57:12 the guard refused kinds.rs as compiling its crate, so road-generator's build scope held rg-buildings.

Root cause: hooks/lint.mjs ran workspace-wide `cargo clippy` + `cargo fmt --check` on every .rs edit, unbudgeted and unshimmed, waiting on the target-dir lock; every edit logged "lint.mjs passed its 120000 ms limit and was ended". Batch 1: wait returned 01:54:31 (cap 01:56:31), the first relief.rs edit sent 01:54:43 landed 01:56:55, the hold had lapsed, roads_group started with no "holding the start" line. Batch 2: cap 02:02:57, edits landed 02:04:06 / 02:06:14 / 02:08:19 / 02:10:23, rg-townplan pid 37440 started 02:09:16, six minutes after the cap.

Fix: hooks/lib/rust-lint.mjs resolves the crate edition; lint runs `rustfmt --check --edition <ed> <file>` only. hooks/lint.test.mjs 10 passed. Follow-ups: KIT-T1425 (wall-clock batch cap lapses under any slow hook), KIT-T1424 (compat-run-limit.test.mjs fails in runtime 9d9fa2b4 too, pre-existing).

## History
- [2026-11-19 01:58] (created) bug — KIT-T1408 regression: builds --wait on rg-buildings/src/relief.rs said 'once the batch's first edit passes, the hold lasts until the batch h
- [2026-11-19 02:26] (status) todo → review
