---
id: KIT-T944
title: checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the fil
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
created: 2026-11-10T17:32:10Z
updated: 2026-11-10T18:08:35Z
---

## Description
checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the file is committed and a different session or agent edits it again, the new dirt is blamed on the first session and the edit is refused as 'another live session has uncommitted changes' (2026-11-10: groovegrid session da28715f vs the standing kit agent on hooks/lib/gate-protocol.mjs, whose only diff was the agent's own edit)

kit-bug-shape: cap:bug:checkout-holder-misfire-kit-d155-a-live-session-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 7337941, 1dfe4e8; tests: hooks/session-overlap.test.mjs (negative controls included); standing kit agent adcd3ffd

## History
- [2026-11-10 17:32] (created) bug — checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the fil
- [2026-11-10 17:32] (comment) seen again in claude-kit: checkout-holder misfire (KIT-D155): a live session write ledger lists a file forever, path only and never cleared on commit, so after it is committed another session or agent editing it is refused as another live session with uncommitted changes (2026-11-10 groovegrid da28715f vs the standing kit ag
- [2026-11-10 17:32] (asked again) 2026-11-10 — cap:bug:checkout-holder-misfire-kit-d155-a-live-session-
- [2026-11-10 17:41] (landed) 7337941 checkout-holder: a session's write ledger keeps when it last wrote each file; a file committed since that write is no lo
- [2026-11-10 17:48] (landed) 1dfe4e8 checkout-holder: the write ledger records the HEAD at each write and a file counts as committed only when a commit touch
- [2026-11-10 18:08] (status) todo → review
