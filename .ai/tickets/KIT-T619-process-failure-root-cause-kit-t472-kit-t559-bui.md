---
id: KIT-T619
title: Process failure (root cause): KIT-T472/KIT-T559 built scoped gates (affected tests, changed crates + reverse deps) but KIT-T563 auto-pin run
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-22T04:55:23Z
updated: 2026-10-22T04:55:23Z
---

## Description
Process failure (root cause): KIT-T472/KIT-T559 built scoped gates (affected tests, changed crates + reverse deps) but KIT-T563 auto-pin runs the consumer's full verify_default ('cargo t', 1790 tests) instead of routing through affected.mjs, so each rapid-game landing cost 125-126 min in stiletto and serialized the rapid-game lane behind it; the rapid-game pre-push gate itself still runs 24-26 min. Nothing enforced a duration ceiling. KIT-D104: every routine op < 5 min. Fix: auto-pin uses the affected/rdeps gate, a broker job over 5 min is reported as a bug, and runtime publish (npm run publish:runtime ran 52 min, killed) is investigated.

kit-bug-shape: cap:bug:process-failure-root-cause-kit-t472-kit-t559-bui
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
KIT-D104 publish gate: run-tests.mjs now runs under a 270 s budget (select.mjs: files the change reaches via the reverse import graph, nearest first, then least recently run; deferred files rotate in; --full or --only runs everything); runtime-publish passes the paths changed since the published runtime. Cause of the 52-min publish: the gate ran the whole suite, 239 files / 46634 s of recorded test time on 8 workers. Tests: select.test.mjs 5 passed.
Auto-pin gate (KIT-D104): pin-scope.mjs + cargo-lock.mjs. Build check plus tests of the consumer crates that depend (Cargo.lock graph) on a changed in-lock crate, config pin_test_args appended (nextest profile without the GPU group); workspace-level file or no lock: build check only; never verify_default. pin-scope.test.mjs 8 passed. select: changed tests / named-for-changed-module tests always run; default budget 200 s. Publish of 5714da1 (T618 + budgeted gate) took 354 s vs 52+ min.
KIT-D104 items: broker overrun report (overrun.mjs, 3 tests); 5-min ceiling in user-config/CLAUDE.global.md; parallelism.test_threads (nextest -j is test threads: rapid-game pre-push nextest ran 3316 tests, 2948 s of test time in 1052 s wall = 2.8x, the broker's -j 3). test-threads.test.mjs 3 passed. Pre-push gate numbers (stiletto target/broker/lanes/rapid-game/results + logs): pre-push 1575 s / 1456 s / 3182 s; nextest 1052 s / 1041 s (changed gate, 1222 tests) / 2139 s; gpu-group serial 723 s in run 1, 251 s in run 3 (39 tests); other tests 2224 s vs 6165 s CPU (machine contention).

## History
- [2026-10-22 04:55] (created) bug — Process failure (root cause): KIT-T472/KIT-T559 built scoped gates (affected tests, changed crates + reverse deps) but KIT-T563 auto-pin run
