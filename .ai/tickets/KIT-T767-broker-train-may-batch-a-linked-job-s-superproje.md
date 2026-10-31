---
id: KIT-T767
title: broker train may batch a linked job's superproject half without its submodule half: dirt-empire j-mvwllsyo-s23z2a (DE-T264, only cell_draw.r
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:26:27Z
updated: 2026-10-31T16:33:26Z
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

## History
- [2026-10-31 16:26] (created) bug — broker train may batch a linked job's superproject half without its submodule half: dirt-empire j-mvwllsyo-s23z2a (DE-T264, only cell_draw.r
- [2026-10-31 16:33] (status) todo → doing
