---
id: KIT-T375
title: broker: killing/restarting the daemon mid-job orphans the job's child process (probe.exe pid 7844 kept running ~23 min after the daemon died
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T16:06:52Z
updated: 2026-10-06T16:06:52Z
---

## Description
broker: killing/restarting the daemon mid-job orphans the job's child process (probe.exe pid 7844 kept running ~23 min after the daemon died and blocked every later probe run with 'failed to remove file target/release/probe.exe'); the daemon should kill its job's process tree on exit and a fresh daemon should reap a stale one it finds

kit-bug-shape: cap:bug:broker-killing-restarting-the-daemon-mid-job-orp
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 16:06] (created) bug — broker: killing/restarting the daemon mid-job orphans the job's child process (probe.exe pid 7844 kept running ~23 min after the daemon died
