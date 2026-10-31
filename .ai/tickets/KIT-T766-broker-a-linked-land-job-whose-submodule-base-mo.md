---
id: KIT-T766
title: broker: a linked --land job whose submodule base moved fails at the land step after a full build (dirt-empire j-mvvpahyd-bofajm, DE-T263): report STALE before the build, and name the next action
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:19:32Z
updated: 2026-10-31T16:19:47Z
---

## Description
A --land job touching the superproject and the rapid-game submodule ran every test green, then failed at land with 'rapid-game: local main (bcdde09492) is not under the recorded 557a94a9c5; a linked job lands on main' after other landings moved the pin while it queued. Cost one full build cycle (~10 min). Fix: processPatch checks the moved base right after admit and returns STALE (phase linked-base, no commands run); the land-step refusal is STALE too; both messages name the next action (wait for the auto-pin, resubmit with --revises).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T482
Fixed: scripts/broker/linked.mjs movedSubmodules + movedMessage (stale, next action); patch.mjs returns STALE phase linked-base right after admit and STALE for a land-step moved-base refusal. Tests: linked-order 4, linked 4 files total 12 passed (linked-order, linked, linked-nothing-landed), patch.test 9 passed. Not built: rebasing the linked patch onto the moved submodule main (the run would be untested against it).

## History
- [2026-10-31 16:19] (created) bug — broker: a linked --land job whose submodule base moved fails at the land step after a full build (dirt-empire j-mvvpahyd-bofajm, DE-T263): report STALE before the build, and name the next action
- [2026-10-31 16:19] (status) todo → review
