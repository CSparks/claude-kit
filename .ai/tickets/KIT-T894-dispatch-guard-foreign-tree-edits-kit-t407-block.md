---
id: KIT-T894
title: dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T18:02:29Z
updated: 2026-11-08T19:53:20Z
---

## Description
dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits and no session or agent holds the tree: it must consult the holder registry and skip when no live writer exists (stiletto-2349 2026-11-08: 13 files, Chris sole user, zero running writers). Also: the dispatch and questionnaire gates should print every missing requirement and the exact accepted tag forms in one pass, and the dispatch-ladder rewrite of the description prefix ([sonnet] -> [Sonnet 5.5]) makes auto mode's classifier refuse the call; accept the canonical form or rewrite before review. Related: KIT-T886, KIT-T888, KIT-T893, KIT-T865

kit-bug-shape: cap:bug:dispatch-guard-foreign-tree-edits-kit-t407-block
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)
- [x] base CLAUDE.md source: kit bug or feature is ticketed and its fix agent dispatched the same turn (KIT-D145); orient and the Stop notice say dispatch now, not 'awaiting a bill of work' (scripts/kit-bug.test.mjs, hooks/kit-bug-dispatch-gate.test.mjs 27, orient 39)

## Plan
1.

## Notes
Fix: removed the foreign-tree-edits check (hooks/dispatch-foreign.mjs, KIT-T407 file attribution): git status minus the write ledger is not a writer (Chris 2026-11-08: 'UNCOMMITTED FUCKING FILES IS NOT THE DEFINITION OF A WRITER'). The one-writer limit stays and is the checkout-holder check (KIT-T811/D123), which reads the live-holder registry (15 min window, own session excluded). [foreign-edits-ok: ...] is now a no-op: nothing blocks on dirty files; it does not lift checkout-holder. Tests: dispatch-foreign-tree 7 PASS, dispatch-holder 20, dispatch-guard 46. Out of scope here: gates printing all requirements in one pass, dispatch-ladder description rewrite vs auto-mode classifier (KIT-T893/T865); KIT-T885/T886 (per-file overlap rule, KIT-D138/D139) untouched. Directive 2 (kit-bugs dispatched immediately in base CLAUDE.md + orient wording) not applied: a relayed agent message cannot authorize editing CLAUDE.md; needs Chris's own approval.
Directive 2 applied under the maintainer's own order (KIT-D145, 2026-11-08): user-config/CLAUDE.global.md kit-bugs section rewritten (ticket + fix agent the same turn, KIT-D094 one standing agent and no inline diagnosis kept), the bill-of-work bullet carries the kit exception, the label bullet names the dispatch-label block, HOOK CONTRACT gets the block-is-satisfied pointer (KIT-D147/D148) and q gates. Orient: kit-ticket OPEN block (scripts/kit-bug.mjs), Stop notice (hooks/kit-bug-dispatch-gate.mjs via kitTicketNotice in hooks/lib/bill-of-work.mjs) and the notice rule line now say dispatch a fix agent for each now; drain.md query-tool failure rule aligned. Other OPEN notices (handoffs, queues) keep 'awaiting a bill of work'. Orient budget (KIT-T071, 4200 chars) has ~15 chars of headroom after the gates line and this wording.

## History
- [2026-11-08 18:02] (created) bug — dispatch-guard foreign-tree-edits (KIT-T407) blocks a writer dispatch when the only dirty files are the maintainer's own uncommitted edits a
- [2026-11-08 18:07] (comment) criterion added: Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)
- [2026-11-08 18:07] (comment) ticked: Uncommitted or modified files never count as a writer: dispatch-guard identifies writers only from the holder registry (hooks/dispatch-foreign-tree.test.mjs)
- [2026-11-08 18:08] (landed) 6d31de3 dispatch-guard: uncommitted files are never a writer; drop the foreign-tree-edits file-attribution check, the holder reg
- [2026-11-08 19:22] (comment) criterion added: base CLAUDE.md source: kit bug or feature is ticketed and its fix agent dispatched the same turn (KIT-D145); orient and the Stop notice say dispatch now, not 'awaiting a bill of work' (scripts/kit-bug.test.mjs, hooks/kit-bug-dispatch-gate.test.mjs 27, orient 39)
- [2026-11-08 19:22] (comment) ticked: base CLAUDE.md source: kit bug or feature is ticketed and its fix agent dispatched the same turn (KIT-D145); orient and the Stop notice say dispatch now, not 'awaiting a bill of work' (scripts/kit-bug.test.mjs, hooks/kit-bug-dispatch-gate.test.mjs 27, orient 39)
- [2026-11-08 19:23] (landed) 85f15d7 base CLAUDE.md and orient: a kit bug or feature is ticketed and its fix agent dispatched the same turn, no bill (kit-bug
- [2026-11-08 19:38] (landed) 9c8ceef plugin 0.1.34: sessions pick up the dispatch-label hook registration and the rewritten kit-bug rules (implements KIT-T89
- [2026-11-08 19:53] (status) todo → review
