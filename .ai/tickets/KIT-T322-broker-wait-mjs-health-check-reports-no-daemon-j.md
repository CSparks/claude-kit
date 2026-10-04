---
id: KIT-T322
title: broker wait.mjs health check reports 'no-daemon: jobs queued, no live broker holds the lock' while target/broker/broker.lock names pid 33516
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T18:50:12Z
updated: 2026-10-04T20:06:59Z
---

## Description
broker wait.mjs health check reports 'no-daemon: jobs queued, no live broker holds the lock' while target/broker/broker.lock names pid 33516 and that node.exe is alive and running job j-muu5sr4c-yb8inm (2026-10-04 18:50Z, stiletto). The liveness probe misreads a live daemon as dead; it prints 'start one' advice that would start a second daemon.

kit-bug-shape: cap:bug:broker-wait-mjs-health-check-reports-no-daemon-j
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] wait never advises starting a daemon while the lock pid is alive or a heartbeat is fresh; a restart gap is not reported; auto-start never starts a second daemon

## Plan
1.

## History
- [2026-10-04 18:50] (created) bug — broker wait.mjs health check reports 'no-daemon: jobs queued, no live broker holds the lock' while target/broker/broker.lock names pid 33516
- [2026-10-04 20:06] (comment) criterion added: wait never advises starting a daemon while the lock pid is alive or a heartbeat is fresh; a restart gap is not reported; auto-start never starts a second daemon
- [2026-10-04 20:06] (comment) ticked: wait never advises starting a daemon while the lock pid is alive or a heartbeat is fresh; a restart gap is not reported; auto-start never starts a second daemon
- [2026-10-04 20:06] (comment) @sonnet55: Causes found: (1) lock.mjs liveHolder treated a lock from another host as DEAD although its comment says fail-safe live  (full comment #1 in ## Notes)
### comment #1 [2026-10-04 20:06] @sonnet55
Causes found: (1) lock.mjs liveHolder treated a lock from another host as DEAD although its comment says fail-safe live (dispatch-broker already treats it live) - fixed; (2) wait/health reported no-daemon on the first poll, which is inside a restart's window (old daemon killed, new one has not written the lock yet) - wait now needs the gap to last 10 s (--grace-ms), health no-daemon is skipped by wait/submit inside the grace; (3) auto-start was check-then-spawn and acquireLock check-then-write - the lock is now created exclusively (wx) and ensureBroker claims broker.spawning exclusively (30 s expiry, cleared when a daemon takes the lock). Observers also accept a heartbeat (broker.beat, written each poll, 60 s) when the pid cannot be probed; the acquire/auto-start check stays pid-based so a killed daemon does not block its replacement. Heartbeat does not tick during one long command (the daemon is synchronous). Tests: scripts/broker/liveness.test.mjs (4 incl. two real daemons racing leave one); ensure.test/health.test adjusted. Mutations: no spawn claim fails 1, cross-host=dead fails 1. Broker suite 116 passed.
- [2026-10-04 20:06] (status) todo → review
