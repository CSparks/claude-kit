---
id: KIT-T985
title: t new regression should require --regressed-from and --causing-commit (or refuse) at creation; today it creates the ticket and only the Stop
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T02:41:09Z
updated: 2026-11-11T02:41:09Z
---

## Description
t new regression should require --regressed-from and --causing-commit (or refuse) at creation; today it creates the ticket and only the Stop-time sync-data integrity check blocks later (dirt-empire DE-T306, 2026-11-10).

kit-bug-shape: cap:feature:t-new-regression-should-require-regressed-from-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
t new regression refuses unless --regressed-from <id> and --causing-commit <sha> are both given (message names the missing flags; shapes checked before an id is minted); both links are written on creation. Enforced in the CLI branch only: triage's scaffoldNew path files regressions from captures without links by design (provenance inferred at intake). New scripts/t/regression-links.mjs, checkLinkTarget export in scripts/t/link.mjs; scripts/t-regression-links.test.mjs 10 passed; t.test 113, t-link 34, t-dedup 10, cli-help 18 passed.

## History
- [2026-11-11 02:41] (created) feature — t new regression should require --regressed-from and --causing-commit (or refuse) at creation; today it creates the ticket and only the Stop
- [2026-11-11 02:50] (landed) 43c0e45 t new regression requires --regressed-from and --causing-commit and writes both links; refusal names the missing flags b
