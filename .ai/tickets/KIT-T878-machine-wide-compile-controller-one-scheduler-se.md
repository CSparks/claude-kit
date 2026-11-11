---
id: KIT-T878
title: MACHINE-WIDE compile controller: one scheduler/semaphore for ALL cargo/rustc/gradle-ndk builds across every project and agent (broker lanes
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:15:32Z
updated: 2026-11-07T17:15:32Z
---

## Description
MACHINE-WIDE compile controller: one scheduler/semaphore for ALL cargo/rustc/gradle-ndk builds across every project and agent (broker lanes are per-repo, so they do not coordinate). Chris 2026-11-07: a massive game freeze between the load screen and gameplay while other builds ran; 'There needs to be a system wide controller of ALL fucking compiling tasks in the kit... The system should never become this fucking unresponsive. This smells like a broker bug.' Evidence at 2026-11-07 17:xx: concurrent 'cargo ndk' release build (pixelvision, 2 targets) + 'cargo test -p dirt-empire -j 15' + earlier stiletto 'cargo t' (build.jobs=24) with 16 of 64 GB RAM free; gate runs 15-25 min. Wants: a global job-slot budget (CPU + commit-limit memory), games/UAT sessions get priority, builds queue or throttle instead of all running at -j 15/24, and a visible 'who is building' readout.

kit-bug-shape: cap:feature:machine-wide-compile-controller-one-scheduler-se
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 17:15] (created) feature — MACHINE-WIDE compile controller: one scheduler/semaphore for ALL cargo/rustc/gradle-ndk builds across every project and agent (broker lanes
