---
id: KIT-T845
title: broker daemon STALLED mid-land (dirt-empire 2026-11-03 01:3x): pid 35624 holds the lock, heartbeat 250 s stale, land job j-mw00c40e-fpo9mi (
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T01:31:08Z
updated: 2026-11-03T02:09:09Z
---

## Description
broker daemon STALLED mid-land (dirt-empire 2026-11-03 01:3x): pid 35624 holds the lock, heartbeat 250 s stale, land job j-mw00c40e-fpo9mi (DE-T286) queued, check j-mw00ael2-6gx04c passed; daemon started by submit.mjs 1 min earlier. Diagnose why a freshly started daemon stops beating while a job is queued, and make the restart automatic and sooner than 10 min when the queue is non-empty.

kit-bug-shape: cap:bug:broker-daemon-stalled-mid-land-dirt-empire-2026-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A queued job never waits for the hourly timing tick: the tick runs only with an empty queue (timing-tick.test)
- [x] The tick costs seconds, not minutes: Cargo.lock graphs are memoised and base-movement diffs cached on disk (cargo-lock.test, timing-moved.test)
- [x] A holder silent for 4 min with a job queued is replaced by the next wait/submit poll; default stall_kill_s is 180 (stall.test)

## Plan
1.

## Notes
e6bdd07 published. Root cause (dirt-empire, daemon 35624, 01:26-01:32 UTC): the hourly timing tick ran synchronously in the drain with a job queued; it re-parsed Cargo.lock per sample (about 650 samples, twice per tick) plus one git diff per result pair, 49 s idle on this machine and minutes under build load, with no heartbeat. Fixed: the tick waits for an empty queue, Cargo.lock graphs memoised (49 s to 4 s warm on dirt-empire), base-movement diffs cached on disk, samples computed once per tick; default stall_kill_s 600 to 180 so the next wait/submit poll replaces a silent daemon. Tests: cargo-lock 2, timing-moved 3, timing-tick 8, stall, watchdog, health, landgate, alias suites passed.

## History
- [2026-11-03 01:31] (created) bug — broker daemon STALLED mid-land (dirt-empire 2026-11-03 01:3x): pid 35624 holds the lock, heartbeat 250 s stale, land job j-mw00c40e-fpo9mi (
- [2026-11-03 01:53] (comment) criterion added: A queued job never waits for the hourly timing tick: the tick runs only with an empty queue (timing-tick.test)
- [2026-11-03 01:53] (comment) criterion added: The tick costs seconds, not minutes: Cargo.lock graphs are memoised and base-movement diffs cached on disk (cargo-lock.test, timing-moved.test)
- [2026-11-03 01:53] (comment) criterion added: A holder silent for 4 min with a job queued is replaced by the next wait/submit poll; default stall_kill_s is 180 (stall.test)
- [2026-11-03 01:53] (status) todo → doing
- [2026-11-03 01:53] (landed) e6bdd07 Broker daemon no longer stalls on the hourly timing tick: the tick waits for an empty queue, Cargo.lock graphs are memoi
- [2026-11-03 02:09] (comment) ticked: A queued job never waits for the hourly timing tick: the tick runs only with an empty queue (timing-tick.test)
- [2026-11-03 02:09] (comment) ticked: The tick costs seconds, not minutes: Cargo.lock graphs are memoised and base-movement diffs cached on disk (cargo-lock.test, timing-moved.test)
- [2026-11-03 02:09] (comment) ticked: A holder silent for 4 min with a job queued is replaced by the next wait/submit poll; default stall_kill_s is 180 (stall.test)
- [2026-11-03 02:09] (status) doing → review
- [2026-11-03 02:09] (landed) 234f36f KIT-T845, KIT-T846 to review with notes [no-test: ticket store only] (implements KIT-T845, KIT-T846)
