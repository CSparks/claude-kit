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
updated: 2026-09-30T23:23:21Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [x] a read-only roster row never blocks a later dispatch; a writer row beside it still does
- [x] one read/write agent per checkout: the count is keyed by [tree:] / named repo root / session checkout; parallel-dispatch removed (KIT-D077)
- [x] [read-only: reason] declares a writer-capable type read-only and is logged on the roster row; agents/researcher-sonnet55.md ships pinned claude-sonnet-5-5

## Plan
1.

## History
- [2026-09-17 20:34] (created) bug — dispatch-guard blocks READ-ONLY agents: shared-tree-dispatch + parallel-dispatch never read the agent definition's tools, so a second analytical lane (researcher/Explore/Plan/code-reviewer) is refused behind another (stiletto 2026-09-17; Chris: parallel analytical agents must run)
- [2026-09-17 20:34] (comment) criterion added: an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [2026-09-17 20:34] (comment) criterion added: a read-only roster row never blocks a later dispatch; a writer row beside it still does
- [2026-09-17 20:34] (comment) ticked: an agent whose definition grants no Edit/Write/NotebookEdit, or a built-in Explore/Plan, passes both checks while a writer is in flight
- [2026-09-17 20:34] (comment) @claude: hooks/dispatch-guard.test.mjs: 109 PASS, suite exit 0 (7 new read-only cases); agent-roster suite passes
- [2026-09-17 20:34] (status) todo → review
- [2026-09-30 23:20] (comment) criterion added: one read/write agent per checkout: the count is keyed by [tree:] / named repo root / session checkout; parallel-dispatch removed (KIT-D077)
- [2026-09-30 23:21] (comment) criterion added: [read-only: reason] declares a writer-capable type read-only and is logged on the roster row; agents/researcher-sonnet55.md ships pinned claude-sonnet-5-5
- [2026-09-30 23:21] (comment) ticked: one read/write agent per checkout: the count is keyed by [tree:] / named repo root / session checkout; parallel-dispatch removed (KIT-D077)
- [2026-09-30 23:21] (comment) @claude: hooks/dispatch-guard.test.mjs 124 PASS (read-only beside writer, all-tools blocked, [tree: other] allowed, [read-only:] allowed+logged, maintainer token two writers); decision KIT-D077
- [2026-09-30 23:23] (comment) ticked: a read-only roster row never blocks a later dispatch; a writer row beside it still does
- [2026-09-30 23:23] (comment) ticked: [read-only: reason] declares a writer-capable type read-only and is logged on the roster row; agents/researcher-sonnet55.md ships pinned claude-sonnet-5-5
- [2026-09-30 23:23] (comment) @claude: suite: 49 node test files in npm test chain pass except server/server.test.mjs (pre-existing: express not installed); 20 trailing files run individually all exit 0; dispatch-guard 124 PASS
- [2026-09-30 23:23] (status) review → review
