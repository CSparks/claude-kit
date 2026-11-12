---
id: KIT-T1103
title: dispatch-guard shared-tree-dispatch misfire 2026-11-12 road-generator: a writer dispatch with NO [tree:] tag (so its tree is the session che
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T18:26:05Z
updated: 2026-11-12T18:33:07Z
---

## Description
dispatch-guard shared-tree-dispatch misfire 2026-11-12 road-generator: a writer dispatch with NO [tree:] tag (so its tree is the session checkout D:/dev/road-generator) was blocked as 'already in flight in this working tree', and the block printed 'tree: D:/dev/dirt-empire' for the new agent. The brief only mentions that path in prose ('another agent in D:/dev/dirt-empire is switching that game onto rg-flora'). The guard appears to infer the tree from any absolute checkout path in the prompt. Wanted: the tree comes only from an explicit [tree: ...] tag, else the session checkout; a test with a prose mention of another checkout passing, and one with a real [tree:] tag to a busy checkout still blocked.

kit-bug-shape: cap:bug:dispatch-guard-shared-tree-dispatch-misfire-2026
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: hooks/dispatch-target.mjs dispatchTargetRoot scanned the prompt (quoted + bare absolute paths, plus cwd/workdir fields) for any repo root differing from the session and retargeted the dispatch there; shared-tree-dispatch, checkout-holder, broker-owned-tree, the roster row and dispatch-escalation all call that one function. Fix df55981: dispatchTarget returns {root, source}: the [tree:] tag when it is a repo root, else the session checkout; prose scan removed, so all five consumers are fixed together. The shared-tree block prints '(from the tree tag)' or '(from the session checkout)'. Tests: hooks/dispatch-shared-tree.test.mjs 59 passed (new: prose mention of a busy other checkout passes; quoted prose passes; [tree:] to the busy checkout still blocks; no tag with a writer in the session checkout still blocks; source wording); hooks/agent-roster.test.mjs 48 passed (prose path records the dispatching tree); dispatch-holder, -broker, -worker, -escalation, -guard, -foreign-tree, -cold-worktree, -lessons, -conformance, -framework, -brief, -job, -ui, -rulings and gate-protocol test files all exit 0. The old tests asserting prose-path retargeting were changed to the [tree:] tag form.

## History
- [2026-11-12 18:26] (created) bug — dispatch-guard shared-tree-dispatch misfire 2026-11-12 road-generator: a writer dispatch with NO [tree:] tag (so its tree is the session che
- [2026-11-12 18:33] (landed) df55981 dispatch-guard: a dispatch's tree is its [tree:] tag, else the session checkout, never a path found in prose; the shared
- [2026-11-12 18:33] (status) todo → review
- [2026-11-12 18:33] (comment) @kit-agent: (fixed) df55981
