---
id: KIT-T1142
title: checkout-holder (KIT-T1114) refuses an edit while ANOTHER writer's cargo build compiles the crate and says 'retry after the build finishes',
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T17:51:43Z
updated: 2026-11-13T17:51:43Z
---

## Description
checkout-holder (KIT-T1114) refuses an edit while ANOTHER writer's cargo build compiles the crate and says 'retry after the build finishes', but broker-wait (KIT-D115) blocks Wait-Process and the only sanctioned wait (wait.mjs <id>) needs a broker job id the subagent did not submit. A subagent in a shared checkout has no sanctioned way to wait for the other writer's build: it can only spin on 'builds' or retry edits. Seen 2026-11-13 in road-generator: rg-buildings edits refused behind pid 11688 (probe build) then pid 37100 (rg-townplan test). Fix: let wait.mjs (or builds --wait) wait on a listed build pid once, foreground, under 170 s.

kit-bug-shape: cap:bug:checkout-holder-kit-t1114-refuses-an-edit-while-
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the hold block message names the exact one-call wait (builds --wait with --timeout 170 --tool-timeout 180) and that wait passes the subagent broker-wait gate
- [x] builds --wait returns 0 at once with no live hold, 0 when the holding build ends or starts its tests, exit 2 at the cap naming the holder
- [x] wait-rule.md, every agent definition, the work and drain briefs, BROKER.md and the global contract say it in one line

## Plan
1.

## History
- [2026-11-13 17:51] (created) bug — checkout-holder (KIT-T1114) refuses an edit while ANOTHER writer's cargo build compiles the crate and says 'retry after the build finishes',
- [2026-11-13 18:10] (comment) criterion added: the hold block message names the exact one-call wait (builds --wait with --timeout 170 --tool-timeout 180) and that wait passes the subagent broker-wait gate
- [2026-11-13 18:10] (comment) criterion added: builds --wait returns 0 at once with no live hold, 0 when the holding build ends or starts its tests, exit 2 at the cap naming the holder
- [2026-11-13 18:10] (comment) criterion added: wait-rule.md, every agent definition, the work and drain briefs, BROKER.md and the global contract say it in one line
- [2026-11-13 18:10] (comment) ticked: the hold block message names the exact one-call wait (builds --wait with --timeout 170 --tool-timeout 180) and that wait passes the subagent broker-wait gate
- [2026-11-13 18:10] (comment) ticked: builds --wait returns 0 at once with no live hold, 0 when the holding build ends or starts its tests, exit 2 at the cap naming the holder
- [2026-11-13 18:10] (comment) ticked: wait-rule.md, every agent definition, the work and drain briefs, BROKER.md and the global contract say it in one line
