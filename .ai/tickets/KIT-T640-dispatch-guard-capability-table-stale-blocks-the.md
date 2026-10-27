---
id: KIT-T640
title: dispatch-guard capability-table-stale blocks the weekly model-reassessment dispatch it demands (deadlock): orient says DISPATCH NOW a sonnet
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T02:54:51Z
updated: 2026-10-27T02:54:51Z
---

## Description
dispatch-guard capability-table-stale blocks the weekly model-reassessment dispatch it demands (deadlock): orient says DISPATCH NOW a sonnet research agent, the guard refuses every Agent call incl. that one; root cause: the stale-table gate has no exemption for the [job: research] reassessment dispatch

kit-bug-shape: cap:bug:dispatch-guard-capability-table-stale-blocks-the
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 02:54] (created) bug — dispatch-guard capability-table-stale blocks the weekly model-reassessment dispatch it demands (deadlock): orient says DISPATCH NOW a sonnet
- [2026-10-27 02:56] (comment) @claude: 2026-10-27 02:55Z: ran model-refresh.mjs with research/models-capability-2026-10-27.md present ('refreshed 2026-10-27')  (full comment #1 in ## Notes)
### comment #1 [2026-10-27 02:56] @claude
2026-10-27 02:55Z: ran model-refresh.mjs with research/models-capability-2026-10-27.md present ('refreshed 2026-10-27') and job-capability.mjs redate 2026-10-27 on 13 rows ('re-dated: ...'); the guard still reports row chore evidence 2026-10-17 and lineup refresh 2026-10-17 stale. The redate/refresh writes and the gate read different tables (runtime 1249b57 vs D:/dev/claude-kit source?). Every Agent dispatch in dirt-empire is blocked meanwhile.
- [2026-10-27 03:00] (comment) @claude: Root cause: model-refresh.mjs and job-capability.mjs, run from the sealed runtime (the path orient prints), wrote into t (full comment #2 in ## Notes)
### comment #2 [2026-10-27 03:00] @claude
Root cause: model-refresh.mjs and job-capability.mjs, run from the sealed runtime (the path orient prints), wrote into the runtime copy, while kitDataText reads the registered checkout's committed HEAD. Fix: kit-data.mjs kitDataWriteRoot/writeRootFor; both writers target the checkout. Tests: kit-data 8, model-refresh 24, job-capability 24, capability-research 9, dispatch-ladder 24 passed.
