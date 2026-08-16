---
id: KIT-T239
title: scripts/test-hooks.mjs (822 lines) over the 600-line gate — split the monolithic hook test runner by hook
type: tech-debt
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes: KIT-T212
superseded_by:
created: 2026-08-16T01:24:16Z
updated: 2026-08-16T01:42:02Z
---

## Description
`scripts/test-hooks.mjs` (817 lines) sat over the pre-write hard limit, so the length gate
refused every Edit to it — three agents were blocked this week. Split it into per-hook test
files next to the hooks, with the fixture/spawn harness extracted for reuse.

Duplicate: KIT-T212 captured the same debt on 2026-08-06 and is still `todo`. Chris to close
one of the two.

## Acceptance Criteria
- [x] The fixture/spawn harness lives in `hooks/test-harness.mjs` and is imported, not copied.
- [x] Every test group moved to a per-hook file (`hooks/<hook>.test.mjs`), appended to the
      existing file where one already covered that hook.
- [x] `scripts/test-hooks.mjs` is gone and `npm test` runs the per-hook files instead.
- [x] Assertion total is unchanged: 136 before, 136 after.
- [x] Suite green, and a deliberate break of one hook still fails its moved test.

## Plan
1. Extract the harness (fixtures, spawn helpers, project/ticket builders, reporter).
2. Move each group to its hook's file; create one where none existed.
3. Retire the monolith, rewire `npm test`, refresh the README pointers.

## History
- [2026-08-16 01:24] (created) tech-debt — scripts/test-hooks.mjs (822 lines) over the 600-line gate — split the monolithic hook test runner by hook
- [2026-08-16 01:24] (status) todo → doing
- [2026-08-16 01:42] (status) doing → review
- [2026-08-16 01:42] (comment) Split scripts/test-hooks.mjs (817 lines, over the 600-line gate) into per-hook test files + hooks/test-harness.mjs. New: hooks/test-harness.mjs 143, lib.test 96, orient.test 131, branch-guard.test 41, hydrate-cache.test 32, lint.test 32, jscpd.test 32, code-graph.test 28; appended groups to commit-gate.test (12->26), pre-write.test (+29), housekeeping.test (6->25), flush.test (11->12), scripts/survey.test (15->22), scripts/cap.test (25->35). Assertions: 136 before (monolith), 136 after (9+22+13+4+3+3+2 new files + 14 commit-gate + 29 pre-write + 19 housekeeping + 1 flush + 7 survey + 10 cap). npm test green through the whole chain; server/server.test.mjs fails on a missing express dep, identical to the pre-change baseline and to the main checkout. Mutation check: an early exit(0) in hooks/branch-guard.mjs turned 4 moved assertions red (13 -> 9 passed, 4 failed); restored, 13/13.
