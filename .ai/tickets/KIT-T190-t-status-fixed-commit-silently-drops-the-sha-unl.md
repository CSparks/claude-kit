---
id: KIT-T190
title: t status --fixed-commit silently drops the sha unless the transition is done on a bug/regression
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:24:17Z
updated: 2026-08-06T02:27:33Z
---

## Description
`t status <id> <state> --fixed-commit <sha>` accepted the flag and wrote nothing unless the
transition was to `done` AND the type was bug or regression — the flag was read INSIDE that branch.
Every other combination discarded it silently. Seen on GB-T039 (2026-08-05): frontmatter
`fixed_commit` stayed empty after a status call that passed the sha.

The two shapes that matter:
* `--fixed-commit` on a **review** transition — the closing shape of every `uat: required` project,
  so the sha was dropped exactly where the evidence floor (KIT-T061) wants it recorded.
* `--fixed-commit` on a non-bug type — a feature's fixing commit is provenance too.

Root cause: an explicit flag was treated as a detail of one branch instead of caller input. A
passed value is now always written and always sha-validated; the missing-sha NUDGE keeps its narrow
done+bug/regression scope, which is what that branch was for.

Provenance: inbox 2026-08-05-1834.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an explicitly passed --fixed-commit sha is written on ANY transition and ANY ticket type
- [x] an invalid sha is rejected wherever it is passed, never silently ignored
- [x] the missing-sha nudge still fires only on a done transition of a bug/regression
- [x] scripts/t.test.mjs covers the review transition, the non-bug type, and the bad sha

## Plan
1. Hoist the fixed_commit write out of the done+bug branch; keep the nudge inside it.
2. Regression tests: a review transition, a non-bug type, and a bad sha on any transition.

## History
- [2026-08-06 02:24] (created) bug — t status --fixed-commit silently drops the sha unless the transition is done on a bug/regression
- [2026-08-06 02:27] (comment) criterion added: an explicitly passed --fixed-commit sha is written on ANY transition and ANY ticket type
- [2026-08-06 02:27] (comment) criterion added: an invalid sha is rejected wherever it is passed, never silently ignored
- [2026-08-06 02:27] (comment) criterion added: the missing-sha nudge still fires only on a done transition of a bug/regression
- [2026-08-06 02:27] (comment) criterion added: scripts/t.test.mjs covers the review transition, the non-bug type, and the bad sha
- [2026-08-06 02:27] (comment) ticked: an explicitly passed --fixed-commit sha is written on ANY transition and ANY ticket type
- [2026-08-06 02:27] (comment) ticked: an invalid sha is rejected wherever it is passed, never silently ignored
- [2026-08-06 02:27] (comment) ticked: the missing-sha nudge still fires only on a done transition of a bug/regression
- [2026-08-06 02:27] (comment) ticked: scripts/t.test.mjs covers the review transition, the non-bug type, and the bad sha
- [2026-08-06 02:27] (status) todo → review
- [2026-08-06 02:27] (comment) fixed: the fixedCommit write is hoisted out of the done+bug branch. Evidence: scripts/t.test.mjs 90 passed, 0 failed (3 new).
