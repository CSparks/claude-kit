---
id: KIT-T275
title: dispatch-guard blocks READ-ONLY agents: shared-tree-dispatch + parallel-dispatch never read the agent definition's tools, so a second analytical lane (researcher/Explore/Plan/code-reviewer) is refused behind another (stiletto 2026-09-17; Chris: parallel analytical agents must run)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-09-17T20:34:12Z
updated: 2026-09-17T20:34:29Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [ ] a read-only roster row never blocks a later dispatch; a writer row beside it still does

## Plan
1.

## History
- [2026-09-17 20:34] (created) bug — dispatch-guard blocks READ-ONLY agents: shared-tree-dispatch + parallel-dispatch never read the agent definition's tools, so a second analytical lane (researcher/Explore/Plan/code-reviewer) is refused behind another (stiletto 2026-09-17; Chris: parallel analytical agents must run)
- [2026-09-17 20:34] (comment) criterion added: an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [2026-09-17 20:34] (comment) criterion added: a read-only roster row never blocks a later dispatch; a writer row beside it still does
- [2026-09-17 20:34] (comment) ticked: an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [2026-09-17 20:34] (comment) @claude: hooks/dispatch-guard.test.mjs: 109 PASS, suite exit 0 (7 new read-only cases); agent-roster suite passes
- [2026-09-17 20:34] (status) todo → review
