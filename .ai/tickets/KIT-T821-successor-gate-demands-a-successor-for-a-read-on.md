---
id: KIT-T821
title: successor-gate demands a successor for a READ-ONLY agent whose report names a ticket (dirt-empire 2026-11-02, researcher a1ce2f682f56a1162):
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T15:29:14Z
updated: 2026-11-02T15:55:53Z
---

## Description
successor-gate demands a successor for a READ-ONLY agent whose report names a ticket (dirt-empire 2026-11-02, researcher a1ce2f682f56a1162): pendingSuccessors skips only non-writers now via readOnlyRow

kit-bug-shape: cap:bug:successor-gate-demands-a-successor-for-a-read-on
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix 72c619b + follow-up: pendingSuccessors and the reconciler skip read-only agents via ownsWork (a patch-worker owns ticket work through the broker and still counts); a read-only row citing a ticket is no successor. Evidence: hooks/handback.test.mjs 30 passed, hooks/successor-gate.test.mjs 16 passed incl. writer control, orient 34, agent-context 37, panel-rows 29, plugin-compat 141.

## History
- [2026-11-02 15:29] (created) bug — successor-gate demands a successor for a READ-ONLY agent whose report names a ticket (dirt-empire 2026-11-02, researcher a1ce2f682f56a1162):
- [2026-11-02 15:29] (comment) seen again in claude-kit: successor-gate demands a successor for a READ-ONLY agent whose report names a ticket (dirt-empire 2026-11-02, researcher a1ce2f682f56a1162)
- [2026-11-02 15:29] (asked again) 2026-11-02 — cap:bug:successor-gate-demands-a-successor-for-a-read-on
- [2026-11-02 15:29] (landed) 72c619b successor-gate: a read-only agent (researcher, Explore, Plan, declared) creates no successor obligation; successor-gate
- [2026-11-02 15:55] (status) todo → review
- [2026-11-02 15:56] (landed) 1002fe7 Ticket store: KIT-T821/T822 to review with evidence, decisions KIT-D129/D130, roadmap and index regenerated, T698/T816/T
