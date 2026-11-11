---
id: KIT-T994
title: ui-framework-first gate misfire: a read-only Explore inventory brief (job research) that listed 'UI' as one category of another repo's conte
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:35:57Z
updated: 2026-11-11T03:35:57Z
---

## Description
ui-framework-first gate misfire: a read-only Explore inventory brief (job research) that listed 'UI' as one category of another repo's contents to catalogue was blocked as UI sizing/layout work. Seen 2026-11-10 in marblequest. The gate should not fire on read-only agent types or on a brief that builds nothing.

kit-bug-shape: cap:bug:ui-framework-first-gate-misfire-a-read-only-expl
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:35] (created) bug — ui-framework-first gate misfire: a read-only Explore inventory brief (job research) that listed 'UI' as one category of another repo's conte
- [2026-11-11 03:47] (landed) a9fea66 ui-framework-first: a read-only dispatch builds no UI and passes; patch-worker and other writers still block (implements
- [2026-11-11 03:53] (comment) @claude: Fix a9fea66 (hooks/dispatch-ui.mjs, hooks/dispatch-ui.test.mjs): uiBlock returns null for read-only dispatches (readOnly (full comment #1 in ## Notes)
### comment #1 [2026-11-11 03:53] @claude
Fix a9fea66 (hooks/dispatch-ui.mjs, hooks/dispatch-ui.test.mjs): uiBlock returns null for read-only dispatches (readOnlyDispatch), patch-worker still blocks. Tests: dispatch-ui.test.mjs 16 passed, dispatch-guard.test.mjs 0 FAIL. My npm run publish:runtime ran the suite: 11 ok, 4 FAIL under load (subtree, pin-scope, hand-write-detect, framework-pin; two reran alone and timed out at 100s with no output, machine saturated by a concurrent publish pid 66532 holding publish.lock). Runtime sha NOT recorded: another session's publish (kit HEAD 05746b8, contains a9fea66) is live; verify current runtime has readOnlyDispatch in hooks/dispatch-ui.mjs after it lands.
