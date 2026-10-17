---
id: KIT-T553
title: broker: scope every lock and wait to one checkout directory and Rust repos only, per the 2026-10-17 decision. Remove the cross-checkout push
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T17:52:40Z
updated: 2026-10-17T18:55:45Z
---

## Description
broker: scope every lock and wait to one checkout directory and Rust repos only, per the 2026-10-17 decision. Remove the cross-checkout push lock (pushlock.mjs, land.mjs:97); a push racing another checkout of the same remote takes the existing refused-push path (undo, rebase, re-gate). Drop C++/CMake from KIT-D096 and BROKER.md; the dispatch guard and broker start refuse a checkout with no Cargo workspace. Tests: two fixture checkouts of one remote land with no shared lock; a non-cargo repo with a broker: block is refused.

kit-bug-shape: cap:feature:broker-scope-every-lock-and-wait-to-one-checkout
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed as KIT-D097 (supersedes KIT-D096 where it differs). Push lock removed (pushlock.mjs, land.mjs); Rust-only refusal in broker.mjs/submit.mjs (cargo-scope.mjs) and the dispatch guard; build-inputs-only scope (build-globs.mjs, build-inputs.mjs) shared by daemon pause and guard; [paths: ...] declaration admits non-build writers. Tests: scripts/broker/scope-invariants.test.mjs (4), push-race.test.mjs (1), build-scope.test.mjs (10), hooks/dispatch-broker.test.mjs (20 pass); broker glob 362 tests, 361-362 pass (train-gate.test.mjs 'gate refusal naming one member' flaked once under load, 3 passed alone).

## History
- [2026-10-17 17:52] (created) feature — broker: scope every lock and wait to one checkout directory and Rust repos only, per the 2026-10-17 decision. Remove the cross-checkout push
- [2026-10-17 18:55] (status) todo → review
