---
id: KIT-T839
title: publish:runtime can never publish a change to a hub module: scripts/id-utils.mjs reaches 273 of 332 tests (about 11 min at 8-16 workers), th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T19:35:32Z
updated: 2026-11-02T21:16:52Z
---

## Description
publish:runtime can never publish a change to a hub module: scripts/id-utils.mjs reaches 273 of 332 tests (about 11 min at 8-16 workers), the 140 s publish budget refuses it (KIT-T825), and a raised budget runs into load flakes (q-server, lock-restore passed alone) and into other sessions' publish lock. Needs a sharded publish suite (broker/Codex) or reach pruning for hub modules.

kit-bug-shape: cap:bug:publish-runtime-can-never-publish-a-change-to-a-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in a8a1455, the commits after it, and runtime bde80d4 (published). (1) Time records: test-times.json now carries a stamp per file (scripts/test-runner/times.mjs); a record older than 7 days or unstamped is stale, keeps its value for planning (capped at 120 s) and its file runs first among the unreached, so the run rewrites it; a first try that dropped stale records to a 30 s guess let a 120 s budget run 306 s, so the value is kept. Recorded times were inflated by load, not only by the T824 stdio bug: the same 56 files summed 877 s at 8 workers and 1003 s at 16; the full suite summed 7707 s at 24 workers against 4388 s recorded at 8. (2) Workers by data (half suite, 166 files): 8 workers 224 s, 16 workers 180 s, 32 workers 170 s; full suite 24 workers 321 s. Every test file is dominated by process spawns (pin.test.mjs: 1308 git spawns, 76.8 s of 78 s), so the machine saturates near half the cores: default workers = clamp(cores/2, 4, 16) (scripts/test-runner/workers.mjs). The pool was already a longest-first work queue. A full suite stays above 5 min at any worker count (about 280-320 s best case), so (3) is the real fix: publish is two-phase. scripts/publish-suite.mjs runs the reached files nearest first inside the budget (120 s) and writes the rest as the owed list; scripts/publish-followup.mjs records it in <runtime>/publish-followup.json and a detached runner (runtime-publish.mjs --followup, npm run publish:followup to re-run) tests it on an export; a failed or dead-unfinished follow-up refuses the NEXT publish, a passed or still-running one does not, and orient prints the state (hooks/lib/orient/notices.mjs). A start gate (scripts/test-runner/start-gate.mjs) re-checks the clock at each start and skips a file that would end past budget x 1.25; a skipped reached file joins the owed list. Also: the export committed through git add -A, 48 s on the D: dev drive; it now commits the source tree through an alternate object store (export phase 58.4 s -> 1.3 s); publish prints its phase times. Measured: a scripts/id-utils.mjs change (reaches 276 of 337 tests) ran phase 1 as 212 files in 129 s wall and owes 108; before, KIT-T825 refused it at the 140 s budget and a full run took about 11 min. Publish of bde80d4 took 172 s end to end (export 1.3 s, suite 165 s). Evidence: scripts/publish-followup.test.mjs 7 passed, scripts/test-runner/runner.test.mjs 24, start-gate.test.mjs 3, select.test.mjs 6, scripts/runtime-publish.test.mjs 33, hooks/orient.test.mjs 37, runtime-wiring 22. Not built: the follow-up for a hub change has not yet run for a real publish (no hub change since); it was exercised on two files through --followup and through launchFollowup.

## History
- [2026-11-02 19:35] (created) bug — publish:runtime can never publish a change to a hub module: scripts/id-utils.mjs reaches 273 of 332 tests (about 11 min at 8-16 workers), th
- [2026-11-02 20:39] (landed) a8a1455 Two-phase publish: reach-limited gate now, the owed remainder as a tracked follow-up that blocks the next publish and sh
- [2026-11-02 20:47] (landed) 956f4ad Publish prints its phase times; runner tests ignore the owed/files/failed env a publish sets (implements KIT-T839)
- [2026-11-02 20:56] (landed) 6c5d873 Publish export commits the source tree through an alternate object store (git add -A took 48 s on the dev drive); a stal
- [2026-11-02 21:11] (landed) 350f8e8 A budgeted run re-checks the clock at each start and skips a file that would end past budget x 1.25; a skipped reached f
- [2026-11-02 21:16] (landed) bde80d4 The detached follow-up runner gets the runtime root; launch test; publish-followup 7 passed (implements KIT-T839)
- [2026-11-02 21:16] (status) todo → review
- [2026-11-02 21:17] (landed) 59bc419 KIT-T839 to review: notes with measured wall times [no-test: ticket store only] (implements KIT-T839)
