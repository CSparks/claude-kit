---
id: KIT-T719
title: broker test tiering (KIT-D110): a landing that changes a crate must also run its dependents' tests. dirt-empire ee1e993 (DE-T227) changed cr
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T00:29:35Z
updated: 2026-10-30T23:23:05Z
---

## Description
broker test tiering (KIT-D110): a landing that changes a crate must also run its dependents' tests. dirt-empire ee1e993 (DE-T227) changed crates/track (MX course generation) and landed on only its own 5 named --test commands; the race tests that depend on MX courses (physics_envelope bike heats, title_demo_laps) went red on main unseen until a later job's base run (DE-T239). The land gate ran exactly the job's --test list.

kit-bug-shape: cap:bug:broker-test-tiering-kit-d110-a-landing-that-chan
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: landgate.mjs returned check + the job's own commands before computing dependents, so a landing with named --test commands never ran the Cargo.lock dependents of the crate it touched (DE-T227: crates/track changed, race tests untested). Fix 5fe8a69: dependents join the explicit branch. Tests: landgate-dependents.test.mjs 4 passed (new case fails on the old landgate.mjs); landgate/affected/train/land/patch tests 79 passed. Heavier landings follow: a dependent's whole default-profile test run now follows each landing (KIT-D110 item 1); KIT-D104 cost is the project's profile tiering.
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; fixed in 5fe8a69: dependents join a land gate that carries the job own --test commands; landgate-dependents 4 passed. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: publish; expect heavier landings (each dependent default-profile test run).
- Files: scripts/broker/landgate.mjs scripts/broker/landgate-dependents.test.mjs

## History
- [2026-10-30 00:29] (created) bug — broker test tiering (KIT-D110): a landing that changes a crate must also run its dependents' tests. dirt-empire ee1e993 (DE-T227) changed cr
- [2026-10-30 23:22] (landed) 5fe8a69 broker land gate: a job's own --test commands no longer hide the dependents of the crate it touched; the gate runs their
- [2026-10-30 23:23] (status) todo → review
