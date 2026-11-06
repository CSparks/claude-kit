---
id: KIT-T873
title: broker: dirt-empire check compile hit 10 min limit (j-mw5ikw2m-49vfj8) with contending cargo daemons; first compile 20+ min
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T874
created: 2026-11-06T22:12:16Z
updated: 2026-11-06T22:12:16Z
---

## Description
broker: dirt-empire check compile hit 10 min limit (j-mw5ikw2m-49vfj8) with contending cargo daemons; first compile 20+ min

kit-bug-shape: cap:bug:broker-dirt-empire-check-compile-hit-10-min-limi
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [x] Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS

## Plan
1.

## History
- [2026-11-06 22:12] (created) bug — broker: dirt-empire check compile hit 10 min limit (j-mw5ikw2m-49vfj8) with contending cargo daemons; first compile 20+ min
- [2026-11-06 23:01] (comment) criterion added: A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [2026-11-06 23:02] (comment) criterion added: Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS
- [2026-11-06 23:02] (comment) ticked: A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [2026-11-06 23:02] (comment) ticked: Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS
- [2026-11-06 23:02] (status) todo → superseded (by KIT-T874)
- [2026-11-06 23:05] (landed) 9172c3f broker: sample foreign cargo builds before a build and at a timeout kill, bounded wait opt-in (implements KIT-T874, KIT-
