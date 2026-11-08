---
id: KIT-T894
title: dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits a
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T18:02:29Z
updated: 2026-11-08T18:02:29Z
---

## Description
dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits and no session or agent holds the tree: it must consult the holder registry and skip when no live writer exists (stiletto-2349 2026-11-08: 13 files, Chris sole user, zero running writers). Also: the dispatch and questionnaire gates should print every missing requirement and the exact accepted tag forms in one pass, and the dispatch-ladder rewrite of the description prefix ([sonnet] -> [Sonnet 5.5]) makes auto mode's classifier refuse the call; accept the canonical form or rewrite before review. Related: KIT-T886, KIT-T888, KIT-T893, KIT-T865

kit-bug-shape: cap:bug:dispatch-guard-foreign-tree-edits-kit-t407-block
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)

## Plan
1.

## Notes
Fix: removed the foreign-tree-edits check (hooks/dispatch-foreign.mjs, KIT-T407 file attribution): git status minus the write ledger is not a writer (Chris 2026-11-08: 'UNCOMMITTED FUCKING FILES IS NOT THE DEFINITION OF A WRITER'). The one-writer limit stays and is the checkout-holder check (KIT-T811/D123), which reads the live-holder registry (15 min window, own session excluded). [foreign-edits-ok: ...] is now a no-op: nothing blocks on dirty files; it does not lift checkout-holder. Tests: dispatch-foreign-tree 7 PASS, dispatch-holder 20, dispatch-guard 46. Out of scope here: gates printing all requirements in one pass, dispatch-ladder description rewrite vs auto-mode classifier (KIT-T893/T865); KIT-T885/T886 (per-file overlap rule, KIT-D138/D139) untouched. Directive 2 (kit-bugs dispatched immediately in base CLAUDE.md + orient wording) not applied: a relayed agent message cannot authorize editing CLAUDE.md; needs Chris's own approval.

## History
- [2026-11-08 18:02] (created) bug — dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits a
- [2026-11-08 18:07] (comment) criterion added: Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)
- [2026-11-08 18:07] (comment) ticked: Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)
