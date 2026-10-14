---
id: KIT-T495
title: broker: a daemon spawned by wait.mjs's stall watchdog (KIT-T488) runs with --idle-exit 60 and writes no daemon log (its stdout goes to the w
type: bug
status: review
priority: critical
asked: 3
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T496
superseded_by:
created: 2026-10-14T21:31:56Z
updated: 2026-10-14T22:22:40Z
---

## Description
broker: a daemon spawned by wait.mjs's stall watchdog (KIT-T488) runs with --idle-exit 60 and writes no daemon log (its stdout goes to the wait shell's pipe, which dies with the worker), is a child of a worker's Bash shell, and nobody owns it: on stiletto 2026-10-14 pid 54596 (a4e695a) replaced pid 60356 mid-landing and left no trace in target/broker beyond the lock. Wanted: a spawned daemon detaches (own process group), logs to target/broker/daemon-<pid>.log, records who spawned it and why (lock: spawnedBy, reason: stalled <job> <phase>), has no --idle-exit a worker did not ask for, and orient/status print that line. --not-dup KIT-T488,KIT-T486,KIT-T322,KIT-T307

kit-bug-shape: cap:bug:broker-a-daemon-spawned-by-wait-mjs-s-stall-watc
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 21:31] (created) bug — broker: a daemon spawned by wait.mjs's stall watchdog (KIT-T488) runs with --idle-exit 60 and writes no daemon log (its stdout goes to the w
- [2026-10-14 21:32] (comment) seen again in stiletto-2349: broker: a daemon spawned by wait.mjs's stall watchdog (KIT-T488) runs with --idle-exit 60 and writes no daemon log (its stdout goes to the wait shell's pipe, which dies with the worker), is a child of a worker's Bash shell, and nobody owns it: on stiletto 2026-10-14 pid 54596 (a4e695a) replaced pid
- [2026-10-14 21:32] (asked again) 2026-10-14 — cap:bug:broker-a-daemon-spawned-by-wait-mjs-s-stall-watc
- [2026-10-14 21:32] (comment) seen again in stiletto-2349: broker: a daemon spawned by wait.mjs's stall watchdog (KIT-T488) runs with --idle-exit 60 and writes no daemon log (its stdout goes to the wait shell's pipe, which dies with the worker), is a child of a worker's Bash shell, and nobody owns it: on stiletto 2026-10-14 pid 54596 (a4e695a) replaced pid
- [2026-10-14 21:32] (asked again) 2026-10-14 — cap:bug:broker-a-daemon-spawned-by-wait-mjs-s-stall-watc
- [2026-10-14 22:22] (comment) @claude: Built: launch.mjs starts the daemon via Win32_Process.Create (hidden, outside the worker shell's tree; detached elsewher (full comment #1 in ## Notes)
### comment #1 [2026-10-14 22:22] @claude
Built: launch.mjs starts the daemon via Win32_Process.Create (hidden, outside the worker shell's tree; detached elsewhere) with --log auto (target/broker/logs/daemon-<time>-<pid>.log); the lock records spawnedBy (who and why: 'wait.mjs pid N: replaced pid P, silent S s on <job> (<phase>)') and log; a replacement for a killed daemon gets no --idle-exit; broker status and orient print the origin and the log. launch.test.mjs 3 passed (live: lock.spawnedBy and lock.log checked), npm test exit 0 (broker 193 passed). KIT-T496 was my duplicate of this, superseded.
- [2026-10-14 22:22] (status) todo → review
