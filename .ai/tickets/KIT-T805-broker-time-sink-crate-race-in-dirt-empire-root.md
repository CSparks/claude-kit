---
id: KIT-T805
title: broker time sink: crate race in dirt-empire/root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T20:32:21Z
updated: 2026-11-01T23:12:42Z
---

## Description
crate race in dirt-empire/root: 1.9 min, 9% of its crate time, 0.2 min/job, worse (+393% per job), #3 (was #22)

kit-bug-shape: broker-blocker:dirt-empire|root|crate|race
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Claimed by the standing kit agent (KIT-D123 hand-off from dirt-empire-83); investigation in progress.
Not yet investigated; queue position after T801-T803 accounting.
Cause: crate race = the land gate's dependents run: 'cargo test --offline -p race' 112 s and 137 s in two landings (j-mvy8zoit-i35hem, j-mvydj8de-fhpscb) of which about 130 s each is a compile (Finished in 2m 10s) and 3.5 s the 9 tests; that landing ran 11 per-crate gate commands totalling 1135 s. Honest tests, wasteful execution: fixed by d00f3db (KIT-T810, one cargo command per workspace so features unify once and shared crates compile once). The 4.1 min stays in the ranking until those two landings age out of the 24 h window (landings after 22:18Z show one 17-20 s gate command). The replay double count is fixed in e7550c8. Project lever: none needed. Tests: landgate-dependents (d00f3db).

## History
- [2026-11-01 20:32] (created) bug — broker time sink: crate race in dirt-empire/root
- [2026-11-01 21:32] (comment) seen again in dirt-empire: crate race in dirt-empire/root: 1.9 min, 8% of its crate time, 0.2 min/job, worse (+217% per job), #3 (was #22)
- [2026-11-01 22:06] (status) todo → doing
- [2026-11-01 22:33] (comment) seen again in dirt-empire: crate race in dirt-empire/root: 4.1 min, 8% of its crate time, 0.2 min/job, worse (+272% per job), #2 (was #22)
- [2026-11-01 22:33] (comment) seen again in dirt-empire: crate race in dirt-empire/root: 4.1 min, 7% of its crate time, 0.2 min/job, worse (+254% per job), #2 (was #22)
- [2026-11-01 23:12] (landed) e7550c8 broker timing: a landing's own check-tree run is no longer stamped as a reused run, and the profile counts only commands
- [2026-11-01 23:12] (status) doing → review
