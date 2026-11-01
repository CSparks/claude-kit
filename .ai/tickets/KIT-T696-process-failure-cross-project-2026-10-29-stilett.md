---
id: KIT-T696
title: Process failure (cross-project, 2026-10-29): Stiletto's test policy (ST-D254 tiered tests: a merge runs touched crates + dependents, GPU gol
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T03:49:43Z
updated: 2026-10-29T03:49:43Z
---

## Description
Process failure (cross-project, 2026-10-29): Stiletto's test policy (ST-D254 tiered tests: a merge runs touched crates + dependents, GPU goldens nightly; ST-D255 slow/perf tests to a nightly suite) and its crate split (ST-T414) live only in Stiletto's store, so dirt-empire runs broad test lists on every change and re-litigates both. Chris: 'this pattern was establisehd with Stiletto and needs to be enforced elsewhere... tests need to FUCKING NIGHTLY, not every fucking change unless troubleshooting and THEN they need to be compartmentalized. WHY THE FUCK doesn't this pattern transfer over?' Root cause: a project decision about SHARED tooling (broker, test tiers) or the framework is never promoted to a kit/framework decision or default. Fix: promote ST-D254/D255 to kit decisions + broker defaults; add a promotion rule (a project decision touching kit/framework concerns must be promoted the same day; orient flags unpromoted ones).

kit-bug-shape: cap:bug:process-failure-cross-project-2026-10-29-stilett
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 03:49] (created) bug — Process failure (cross-project, 2026-10-29): Stiletto's test policy (ST-D254 tiered tests: a merge runs touched crates + dependents, GPU gol
