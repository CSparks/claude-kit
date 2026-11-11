---
id: KIT-T959
title: broker 2026-11-10 (dirt-empire-f0): a rapid-game lane sat with queued jobs and no daemon. Job j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapi
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:23:40Z
updated: 2026-11-10T18:23:40Z
---

## Description
broker 2026-11-10 (dirt-empire-f0): a rapid-game lane sat with queued jobs and no daemon. Job j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapid-game) and two more waited in target/broker/lanes/rapid-game/queue until a daemon started 18:21:09Z while the root lane's daemon was alive (about an hour idle). Needed: any lane with queue/ entries gets a daemon within a minute; broker status flags a queued lane with no daemon. Related done: KIT-T916 (restart ignores queue).

kit-bug-shape: cap:bug:broker-2026-11-10-dirt-empire-f0-a-rapid-game-la
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:23] (created) bug — broker 2026-11-10 (dirt-empire-f0): a rapid-game lane sat with queued jobs and no daemon. Job j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapi
