---
id: KIT-T606
title: dispatch-guard capability-table-stale blocks EVERY dispatch (all jobs) when one row is stale; the 'asset' row's basis is maintainer decision
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T06:42:19Z
updated: 2026-10-21T06:42:19Z
---

## Description
dispatch-guard capability-table-stale blocks EVERY dispatch (all jobs) when one row is stale; the 'asset' row's basis is maintainer decision only (research/models-capability-2026-10-17.md:37, 'no source evidence on any model; not re-dated'), so the weekly evidence period can never be met by research and the gate shuts all delegation, including the research agent that would refresh it (chicken-and-egg). Fix: a maintainer-basis (M) row needs a re-confirm path, not source evidence; and staleness should block only dispatches of the stale job, never the research job. Hit 2026-10-21 01:40 CDT in stiletto-2349 blocking 4 framework patch workers.

kit-bug-shape: cap:bug:dispatch-guard-capability-table-stale-blocks-eve
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 06:42] (created) bug — dispatch-guard capability-table-stale blocks EVERY dispatch (all jobs) when one row is stale; the 'asset' row's basis is maintainer decision
