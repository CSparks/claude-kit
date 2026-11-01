---
id: KIT-T800
title: kit-bug-dispatch-gate demands an Agent dispatch for tickets another session holds under KIT-D123: on 2026-11-01 the marblequest session disp
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:45:45Z
updated: 2026-11-01T19:53:04Z
regressed_from: KIT-T793
---

## Description
kit-bug-dispatch-gate demands an Agent dispatch for tickets another session holds under KIT-D123: on 2026-11-01 the marblequest session dispatched a second kit writer into claude-kit while infra-09 held it, and that writer committed kit hook work as 91541d9 titled with a marblequest MAR-T035 message. The gate should name the holding session and accept a hand-off instead of a dispatch.

kit-bug-shape: cap:bug:kit-bug-dispatch-gate-demands-an-agent-dispatch-
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A SendMessage hand-off naming the ticket clears the gate inside the 4 h window and lapses after it; tested from a non-kit root (hooks/kit-bug-dispatch-gate.test.mjs)

## Plan
1.

## Notes
regressed_from KIT-T793 (the registry-found kit store) and shares its root with KIT-T736 (9dc81e4). Already true before this change: a SendMessage naming the id, to any recipient, cleared the Stop gate. Added: a hand-off counts only inside the 4 h claim window (CLAIM_TTL_MS, now exported from scripts/kit-bug.mjs; entry timestamp read from the transcript, absent timestamp counts), so a hand-off the holder never claims lapses and the ticket blocks again; Agent/Task dispatches are unchanged; the block text now names the SendMessage hand-off to a holding session (KIT-D123). A claimed ticket (doing, touched within 4 h) is never open, so a lapsed hand-off does not reopen it. Tests from a non-kit root through the registry: hooks/kit-bug-dispatch-gate.test.mjs 21 passed (4 new KIT-T800 cases).

## History
- [2026-11-01 19:45] (created) bug — kit-bug-dispatch-gate demands an Agent dispatch for tickets another session holds under KIT-D123: on 2026-11-01 the marblequest session disp
- [2026-11-01 19:46] (status) todo → doing
- [2026-11-01 19:53] (comment) criterion added: A SendMessage hand-off naming the ticket clears the gate inside the 4 h window and lapses after it; tested from a non-kit root (hooks/kit-bug-dispatch-gate.test.mjs)
- [2026-11-01 19:53] (comment) ticked: A SendMessage hand-off naming the ticket clears the gate inside the 4 h window and lapses after it; tested from a non-kit root (hooks/kit-bug-dispatch-gate.test.mjs)
- [2026-11-01 19:53] (status) doing → review
- [2026-11-01 19:53] (landed) 3a53eb4 kit-bug-dispatch-gate: a SendMessage hand-off naming the ticket counts inside the 4 h claim window and lapses after it w
