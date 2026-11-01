---
id: KIT-T793
title: regression of KIT-T768 (0180c1f): the kit-bug-dispatch Stop gate in dirt-empire-83 (D:/dev/claude-kit/hooks/kit-bug-dispatch-gate.mjs via co
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:31:13Z
updated: 2026-11-01T19:37:06Z
regressed_from: KIT-T768
---

## Description
regression of KIT-T768 (0180c1f): the kit-bug-dispatch Stop gate in dirt-empire-83 (D:/dev/claude-kit/hooks/kit-bug-dispatch-gate.mjs via compat-run) still blocks on KIT-T792 and KIT-T768, both status doing in the claude-kit store and held by infra-09's kit agent. The claim lookup likely reads the session's own store (dirt-empire), not the claude-kit store. A kit ticket in review or done must also never block

kit-bug-shape: cap:bug:regression-of-kit-t768-0180c1f-the-kit-bug-dispa
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not reproduced as a store-resolution bug: kitStoreRoot() reads the registry project claude-kit (or CLAUDE_KIT_BUG_STORE), never the session store; run from D:\dev\dirt-empire against the real store, openKitBugPage listed KIT-T768 (doing, untouched since 2026-10-31 11:37, past the 4 h claim window) and not the freshly claimed tickets. Causes of the observed block: (1) KIT-T768 was left doing after its landing, so its claim expired by design - set to review; (2) hooks run from the sealed runtime (compat-run), so 0180c1f reached sessions only with the publish at 99d4cc5; (3) KIT-T792 was listed between filing and its claim. Added tests (hooks/kit-bug-dispatch-gate.test.mjs, 17 passed): store found through the registry from a non-kit root, live claim passes, stale claim blocks, review/done/superseded never block.

## History
- [2026-11-01 19:31] (created) bug — regression of KIT-T768 (0180c1f): the kit-bug-dispatch Stop gate in dirt-empire-83 (D:/dev/claude-kit/hooks/kit-bug-dispatch-gate.mjs via co
- [2026-11-01 19:35] (status) todo → doing
- [2026-11-01 19:37] (status) doing → review
