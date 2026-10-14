---
id: KIT-T491
title: broker result json carries per-phase timings: {queuedMs, applyMs, gateMs, runMs (per command already), landMs: {commit, prePush, push, pin}}
type: feature
status: review
priority: high
asked: 2
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T20:21:18Z
updated: 2026-10-14T20:41:09Z
---

## Description
broker result json carries per-phase timings: {queuedMs, applyMs, gateMs, runMs (per command already), landMs: {commit, prePush, push, pin}} so vetting (ST-T904) and KIT-T482 targets (1.5x single-job wall, last green within 15 min) are measurable from results alone; today only startedAt/finishedAt plus command durationMs

kit-bug-shape: cap:feature:broker-result-json-carries-per-phase-timings-que
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 20:21] (created) feature — broker result json carries per-phase timings: {queuedMs, applyMs, gateMs, runMs (per command already), landMs: {commit, prePush, push, pin}}
- [2026-10-14 20:22] (comment) seen again in stiletto-2349: broker result json carries per-phase timings: {queuedMs, applyMs, gateMs, runMs (per command already), landMs: {commit, prePush, push, pin}} so vetting (ST-T904) and KIT-T482 targets (1.5x single-job wall, last green within 15 min) are measurable from results alone; today only startedAt/finishedAt p
- [2026-10-14 20:22] (asked again) 2026-10-14 — cap:feature:broker-result-json-carries-per-phase-timings-que
- [2026-10-14 20:41] (comment) @claude: Built: phase.mjs tracks apply, gate, run, commit, pre-push gate, rebase, reverify, push, pin; results carry timings [{ph (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:41] @claude
Built: phase.mjs tracks apply, gate, run, commit, pre-push gate, rebase, reverify, push, pin; results carry timings [{phase, ms}]; wait's heartbeat names the landing phase and its age ('phase pre-push gate for 540s'). scripts/broker/phase.test.mjs 3 passed (check-only negative control). Broker 168 passed.
- [2026-10-14 20:41] (status) todo → review
