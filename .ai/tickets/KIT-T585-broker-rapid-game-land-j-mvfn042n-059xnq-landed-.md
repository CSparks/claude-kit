---
id: KIT-T585
title: broker: rapid-game land j-mvfn042n-059xnq landed ccecad6 (on origin/main) but result.landed.superSha is null: no superproject re-pin commit,
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T19:25:09Z
updated: 2026-10-20T00:52:06Z
fixed_commit: 6408069
---

## Description
broker: rapid-game land j-mvfn042n-059xnq landed ccecad6 (on origin/main) but result.landed.superSha is null: no superproject re-pin commit, and dirt-empire/rapid-game checkout stays detached at 60fb8fc without the files, so a following dirt-empire job cannot compile rg_testkit::lint

kit-bug-shape: cap:bug:broker-rapid-game-land-j-mvfn042n-059xnq-landed-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 19:25] (created) bug — broker: rapid-game land j-mvfn042n-059xnq landed ccecad6 (on origin/main) but result.landed.superSha is null: no superproject re-pin commit,
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) root cause: the auto-pin submit for a land_gate: affected consumer was refused (--no-patch with no --test) inside a detached submit whose output was discarded, so no pin job was ever queued; the pin now carries the consumer's check and logs to target/broker/logs/auto-pin.log; test scripts/broker/autopin-affected.test.mjs (3 passed, negative control: the bare pin is refused)
