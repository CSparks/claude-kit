---
id: KIT-T767
title: broker train may batch a linked job's superproject half without its submodule half: dirt-empire j-mvwllsyo-s23z2a (DE-T264, only cell_draw.r
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:26:27Z
updated: 2026-10-31T16:42:44Z
---

## Description
broker train may batch a linked job's superproject half without its submodule half: dirt-empire j-mvwllsyo-s23z2a (DE-T264, only cell_draw.rs + tests) went red compiling crates/bike/src/voice.rs and crates/truck/src/voice.rs with missing EngineSpec/LowWeight fields, which come from DE-T263's linked job j-mvwlly01-euk9fb (rapid-game rg-synth spec.rs plus those voice.rs files) while the checkout's rapid-game still had the old struct; logs dirt-empire target/broker/logs/j-mvwllsyo-s23z2a-*.log; unverified report from dirt-empire-83

kit-bug-shape: cap:bug:broker-train-may-batch-a-linked-job-s-superproje
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Investigated from dirt-empire records; the train hypothesis is refuted. j-mvwllsyo-s23z2a (DE-T264) was a check-only job (land false), not a train member (no train- id, train-form.mjs trainable() excludes any job touching a submodule path; scripts/broker/linked.test.mjs 'a linked job never rides a train' 1 passed). It ran alone in target/broker/check/dirt-empire 11:12:45-11:16:05 CDT with base a311110; check-tree reflog shows super a311110 and rapid-game 68b4d95 (the pin, EngineSpec without burble/high_tame) checked out at 11:12:44/45. Its patch was 4 files (cell_draw.rs + tests). The linked job j-mvwlly01-euk9fb (DE-T263) did not start its run until ~11:22 CDT and landed 11:29. Its precheck uses a separate target dir (target/broker/precheck-target). In the failing log cargo recompiled truck and bike but NOT rg-synth, and the E0063 errors name fields only 303bf3d has: an rg-synth artifact built from NEW spec.rs was judged fresh against the old spec.rs. Dep-info paths in target/debug/deps are workspace-relative, so live, check and lane trees share artifacts; Cargo freshness is mtime only. No rg-synth artifact was built between 10-30 16:20 and 11:27 CDT that survives (the key was rebuilt in place at 11:27), so the source of the new-spec artifact is not recoverable. Open: which tree built the new-source artifact. Lever 3 (dirty-reason capture) records exactly that next time. No code change made. [no-test: investigation; hypothesis refuted by records, cause not reproduced]
Hypothesis (a) and the train both refuted, cause confirmed as the shared-target mtime freshness leak; fixed under KIT-T769 (content-align.mjs, build-guard.mjs). Tests: content-align.test.mjs 5, build-guard.test.mjs 4 passed. See KIT-T769 Notes.

## History
- [2026-10-31 16:26] (created) bug — broker train may batch a linked job's superproject half without its submodule half: dirt-empire j-mvwllsyo-s23z2a (DE-T264, only cell_draw.r
- [2026-10-31 16:33] (status) todo → doing
- [2026-10-31 16:42] (status) doing → review
