---
id: KIT-T674
title: capability table: add a 'greenfield' job routed to opus (DE-D057, Chris 2026-10-28: 'ANy new greenfield stuff gets the first pass with Opus.
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T18:34:52Z
updated: 2026-10-28T18:57:05Z
---

## Description
capability table: add a 'greenfield' job routed to opus (DE-D057, Chris 2026-10-28: 'ANy new greenfield stuff gets the first pass with Opus.'); dispatch-guard should accept [job: greenfield] on opus without escalate/override tags

kit-bug-shape: cap:feature:capability-table-add-a-greenfield-job-routed-to-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 4bf9692. Tests: hooks/dispatch-guard.test.mjs (greenfield on opus passes without escalate/override; sonnet blocked; fix on opus still blocked), scripts/agent-pins.test.mjs 18 passed, scripts/plugin-compat.test.mjs 123 passed, job-capability 24 passed, dispatch-ladder 24 passed. Decisions KIT-D108 (greenfield), KIT-D109 (screenshot rule).

## History
- [2026-10-28 18:34] (created) feature — capability table: add a 'greenfield' job routed to opus (DE-D057, Chris 2026-10-28: 'ANy new greenfield stuff gets the first pass with Opus.
- [2026-10-28 18:57] (status) todo → review
