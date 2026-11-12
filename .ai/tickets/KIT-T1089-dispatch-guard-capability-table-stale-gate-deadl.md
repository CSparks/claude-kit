---
id: KIT-T1089
title: dispatch-guard capability-table-stale gate deadlocks its own fix (KIT-T339): when a row goes stale it blocks EVERY Agent dispatch, including
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T01:25:30Z
updated: 2026-11-12T01:25:30Z
---

## Description
dispatch-guard capability-table-stale gate deadlocks its own fix (KIT-T339): when a row goes stale it blocks EVERY Agent dispatch, including the research agent that writes the capability table model-refresh.mjs requires, so the weekly reassessment cannot be dispatched. 2026-11-11: orchestrator had to do the web research inline. Fix: exempt a dispatch with [job: research] whose brief names research/models-capability-<date>.md (or paths limited to research/ and .ai/config.yml) from the stale-table check, or make the weekly reassessment run itself before the gate closes (refresh warning at 5 days, block at 7)

kit-bug-shape: cap:bug:dispatch-guard-capability-table-stale-gate-deadl
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Decision: a new tag [model-refresh: <date>], not file-name detection. gate-tokens.mjs is the one definition: q gates agent prints the form and gate-protocol.test proves it matches its pattern; a bare file-name match would exempt any brief that merely mentions research/models-capability-<date>.md. Exempt iff all four hold: job is research, the tag is present, the brief names research/models-capability-<same date>.md, and [paths:] are declared with every path under research/, .ai/decisions/, or equal to .ai/config.yml or .ai/model-lineup.json (no .. segment, no *). The fourth file is what model-refresh.mjs writes (model-refresh.mjs:103), so an honest refresh agent is not re-deadlocked. Early warning: a row age >= refresh_days - 2 (5 of 7) passes with a reminder once per session (turn-state slot capability-stale-warned). Block unchanged: age > refresh_days. Code: hooks/lib/capability-stale.mjs, wired in hooks/dispatch-guard.mjs; q gates agent lists capability-table-stale in hooks/lib/gate-protocol.mjs; hooks/gate-protocol.test.mjs no longer treats it as warn-only. Tests: hooks/dispatch-guard-stale.test.mjs 18 pass; 9 of 9 control mutations killed on a git archive copy. Handoff KIT-T1089 kit-agent: Jobs: fix. State: landed, see History. Next: none. Files: hooks/lib/capability-stale.mjs, hooks/dispatch-guard.mjs, hooks/lib/gate-tokens.mjs, hooks/lib/gate-protocol.mjs, hooks/gate-protocol.test.mjs, hooks/dispatch-guard-stale.test.mjs.

## History
- [2026-11-12 01:25] (created) bug — dispatch-guard capability-table-stale gate deadlocks its own fix (KIT-T339): when a row goes stale it blocks EVERY Agent dispatch, including
