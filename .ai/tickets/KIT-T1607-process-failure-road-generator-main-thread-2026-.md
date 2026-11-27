---
id: KIT-T1607
title: process failure (road-generator main thread 2026-11-26): dispatched a push-drift gate fix (KIT-T1601) that follows cd/Set-Location inside a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T06:34:51Z
updated: 2026-11-27T06:39:07Z
---

## Description
process failure (road-generator main thread 2026-11-26): dispatched a push-drift gate fix (KIT-T1601) that follows cd/Set-Location inside a command, the same class RDG-D191 reverted the day before ('following a nested cd', KIT-T1552), without reading RDG-D191 first; it drew two rounds of security findings. Root cause: a kit-gate fix brief is not matched against the rulings that govern gate relaxations (brief-decisions runs only for plan/design/analyst-max/perf briefs). Prevention: run the brief-decisions match on every brief that names a hooks/ gate file or a kit-bug ticket on a gate, so a revert ruling like RDG-D191 is named before dispatch.

kit-bug-shape: cap:bug:process-failure-road-generator-main-thread-2026-:0168a283
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 493ed740: dispatch-decisions.mjs touchesGate widens isGroundedDispatch to any brief naming a path under hooks/, a [paths: hooks] tag, or a ticket id beside a hyphenated gate name (source-shell-gate, dispatch-guard); the decision match and its escape are unchanged. Tests: hooks/dispatch-decisions-gate.test.mjs 7 pass (a fix brief on the push gate with a gate-revert ruling in the store is blocked naming it; ticket and tag forms; naming the id clears; two negative controls), hooks/dispatch-decisions.test.mjs 15 pass.

## History
- [2026-11-27 06:34] (created) bug — process failure (road-generator main thread 2026-11-26): dispatched a push-drift gate fix (KIT-T1601) that follows cd/Set-Location inside a
- [2026-11-27 06:38] (landed) 493ed740 dispatch-guard brief-decisions: a brief of any job that names a path under hooks/, a [paths: hooks] tag, or a ticket bes
- [2026-11-27 06:39] (comment) @claude: (fixed) 493ed740; dispatch-decisions-gate 7 pass, dispatch-decisions 15 pass
- [2026-11-27 06:39] (status) todo → review
