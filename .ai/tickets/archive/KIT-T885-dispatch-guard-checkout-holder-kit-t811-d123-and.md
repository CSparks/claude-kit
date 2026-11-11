---
id: KIT-T885
title: dispatch-guard checkout-holder (KIT-T811/D123) and foreign-tree-edits (KIT-T407) block a second writer in the claude-kit checkout, which has
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:51:59Z
updated: 2026-11-10T00:29:39Z
fixed_commit: 65c1e14
---

## Description
dispatch-guard checkout-holder (KIT-T811/D123) and foreign-tree-edits (KIT-T407) block a second writer in the claude-kit checkout, which has no build tree. Chris 2026-11-07: 'KIT is not a fucking compiled language project, so there should not BE a fuckign writer limit on KIT.' Exempt the claude-kit checkout from both gates; keep them for compiled trees (KIT-D077). Blocked the KIT-T860 / KIT-D137 fix for an hour.

kit-bug-shape: cap:bug:dispatch-guard-checkout-holder-kit-t811-d123-and
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 17:52] (created) bug — dispatch-guard checkout-holder (KIT-T811/D123) and foreign-tree-edits (KIT-T407) block a second writer in the claude-kit checkout, which has
- [2026-11-07 17:55] (comment) @claude: Chris 2026-11-07: "The ONLY writer limit on Claude Kit should be that two writers on one file is forbidden." Fix shape:  (full comment #1 in ## Notes)
### comment #1 [2026-11-07 17:55] @claude
Chris 2026-11-07: "The ONLY writer limit on Claude Kit should be that two writers on one file is forbidden." Fix shape: replace the checkout-holder and foreign-tree-edits gates, for the claude-kit checkout, with a file-overlap gate: block only when the dispatch brief names or touches a file another live writer holds (uncommitted edit by another session). See KIT-D138.
- [2026-11-10 00:17] (comment) @claude: KIT-D155 (Chris 2026-11-09: 'There will be other sessions on KIT, that shouldn't be raising flags unless the two are wri (full comment #2 in ## Notes)
### comment #2 [2026-11-10 00:17] @claude
KIT-D155 (Chris 2026-11-09: 'There will be other sessions on KIT, that shouldn't be raising flags unless the two are writing to the same files.') narrows this: the kit checkout is judged per file, not exempt. Landed in the checkout-holder guard (writer dispatch with [paths:], and an edit via holder-beat) and the commit-foreign gate: a flag only when a path the incoming writer touches is dirty and in another LIVE session's write ledger. Other repos keep the whole-checkout rule.
- [2026-11-10 00:29] (landed) 65c1e14 kit checkout: other live sessions raise no flag unless two sessions write one file; the checkout-holder guard (writer di
- [2026-11-10 00:29] (status) todo → done
