---
id: KIT-T568
title: broker: job j-mvekiha9-oya0no (dirt-empire, DE-T145 livery) sits 'dirty at apply' for 10+ min (since 20:20 CDT) while another agent hand-edi
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T01:31:15Z
updated: 2026-10-19T01:55:32Z
---

## Description
broker: job j-mvekiha9-oya0no (dirt-empire, DE-T145 livery) sits 'dirty at apply' for 10+ min (since 20:20 CDT) while another agent hand-edits vehicle.rs/tests in the checkout; no ETA or owner shown, no way to tell when the queue resumes. wait.mjs returns instantly on dirty so a worker must poll. Log: D:/dev/dirt-empire/target/broker

kit-bug-shape: cap:bug:broker-job-j-mvekiha9-oya0no-dirt-empire-de-t145
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: the dispatch guard (KIT-D077/D097) is dispatch-time only and blocks only writers dispatched while a lane lock is live; a daemon started later (submit/wait autostart) or a hand edit by the main thread was never checked, and the broker's dirty refusal named no paths, holder or age. Fix 75b5d8a: hand-hold.mjs (paths, age, probable session from the write ledger) in the dirty message, wait, status, daemon log, self-check hand-edit-hold after 5 min (orient prints health.json), startup notice in ensureBroker/broker.mjs, one-time pre-write warning for build-input edits under a live daemon. Tests: scripts/broker/hand-hold.test.mjs 8 passed, hooks/lib/broker-hand-edit.test.mjs 3 passed, related broker tests 48 passed in all. Not published: publish:runtime runs the whole npm test.

## History
- [2026-10-19 01:31] (created) bug — broker: job j-mvekiha9-oya0no (dirt-empire, DE-T145 livery) sits 'dirty at apply' for 10+ min (since 20:20 CDT) while another agent hand-edi
- [2026-10-19 01:55] (status) todo → review
