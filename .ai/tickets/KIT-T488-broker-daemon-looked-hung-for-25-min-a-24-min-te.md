---
id: KIT-T488
title: Broker daemon looked hung for 25 min: a 24-min test-only full-suite job (cargo test -p dirt-empire, j-mv8hjxwe-cxbkqs) wrote no heartbeat; status said running; nothing detects or restarts a truly wedged daemon
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T19:59:34Z
updated: 2026-10-14T20:00:19Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)

## Plan
1.

## History
- [2026-10-14 19:59] (created) bug — Broker daemon looked hung for 25 min: a 24-min test-only full-suite job (cargo test -p dirt-empire, j-mv8hjxwe-cxbkqs) wrote no heartbeat; status said running; nothing detects or restarts a truly wedged daemon
- [2026-10-14 20:00] (comment) criterion added: The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)
- [2026-10-14 20:00] (comment) ticked: The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)
- [2026-10-14 20:00] (comment) @claude: Cause (read-only, D:\dev\dirt-empire\target\broker): not a hang. After j-mv8hjxwe-cxbkqs started at 19:17:49Z, the daemo (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:00] @claude
Cause (read-only, D:\dev\dirt-empire\target\broker): not a hang. After j-mv8hjxwe-cxbkqs started at 19:17:49Z, the daemon ran a test-only job (no ops, no ticket) whose command was the full suite 'cargo test --offline -p dirt-empire': 1,426 s, finished 19:41:55Z, passed. The beat is written only between drains, so it froze for the whole run and status still said 'running'. Fixed: pulse during commands; STALLED status and health entry; a watchdog restart in submit/wait past 10 min. Broker 162 passed.
- [2026-10-14 20:00] (status) todo → review
