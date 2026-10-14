---
id: KIT-T490
title: broker wait.mjs heartbeat names the phase: during a --land job's land+push (28.5 of 30.5 min on stiletto job j-mv8iws2u-5h6zad: rapid-game p
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
created: 2026-10-14T20:21:14Z
updated: 2026-10-14T20:41:05Z
---

## Description
broker wait.mjs heartbeat names the phase: during a --land job's land+push (28.5 of 30.5 min on stiletto job j-mv8iws2u-5h6zad: rapid-game pre-push gate + pin) the heartbeat kept printing 'running 1784s, on command 4', which misleads; print 'landing: pre-push gate <repo>' / 'pushing' / 'pinning <superproject>' with elapsed time

kit-bug-shape: cap:feature:broker-wait-mjs-heartbeat-names-the-phase-during
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 20:21] (created) feature — broker wait.mjs heartbeat names the phase: during a --land job's land+push (28.5 of 30.5 min on stiletto job j-mv8iws2u-5h6zad: rapid-game p
- [2026-10-14 20:22] (comment) seen again in stiletto-2349: broker wait.mjs heartbeat names the phase: during a --land job's land+push (28.5 of 30.5 min on stiletto job j-mv8iws2u-5h6zad: rapid-game pre-push gate + pin) the heartbeat kept printing 'running 1784s, on command 4', which misleads; print 'landing: pre-push gate <repo>' / 'pushing' / 'pinning <sup
- [2026-10-14 20:22] (asked again) 2026-10-14 — cap:feature:broker-wait-mjs-heartbeat-names-the-phase-during
- [2026-10-14 20:41] (comment) @claude: Built: phase.mjs tracks apply, gate, run, commit, pre-push gate, rebase, reverify, push, pin; results carry timings [{ph (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:41] @claude
Built: phase.mjs tracks apply, gate, run, commit, pre-push gate, rebase, reverify, push, pin; results carry timings [{phase, ms}]; wait's heartbeat names the landing phase and its age ('phase pre-push gate for 540s'). scripts/broker/phase.test.mjs 3 passed (check-only negative control). Broker 168 passed.
- [2026-10-14 20:41] (status) todo → review
