---
id: KIT-T809
title: kit-bug-dispatch-gate hand-off match needs the full id: a SendMessage that named 'KIT-T801, T802, T803, T797, T805, T796 and T804' counted o
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T22:07:00Z
updated: 2026-11-01T22:07:51Z
---

## Description
kit-bug-dispatch-gate hand-off match needs the full id: a SendMessage that named 'KIT-T801, T802, T803, T797, T805, T796 and T804' counted only KIT-T801 as handed off, and the Stop gate then blocked on KIT-T805 and KIT-T796 (infra session, 2026-11-01). A bare T### in a message that already names a KIT-T id should resolve to the same key

kit-bug-shape: cap:bug:kit-bug-dispatch-gate-hand-off-match-needs-the-f
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A bare T### in a hand-off that names a full KIT-T id clears that ticket (hooks/kit-bug-dispatch-gate.test.mjs)

## Plan
1.

## Notes
A bare T### in a hand-off message resolves to every full KEY-T### key that message names (withBareIdsExpanded in hooks/kit-bug-dispatch-gate.mjs); a message naming no full id resolves nothing. hooks/kit-bug-dispatch-gate.test.mjs 24 passed incl. 3 KIT-T809 cases from a non-kit root through the registry.

## History
- [2026-11-01 22:07] (created) bug — kit-bug-dispatch-gate hand-off match needs the full id: a SendMessage that named 'KIT-T801, T802, T803, T797, T805, T796 and T804' counted o
- [2026-11-01 22:07] (status) todo → doing
- [2026-11-01 22:07] (comment) criterion added: A bare T### in a hand-off that names a full KIT-T id clears that ticket (hooks/kit-bug-dispatch-gate.test.mjs)
- [2026-11-01 22:07] (comment) ticked: A bare T### in a hand-off that names a full KIT-T id clears that ticket (hooks/kit-bug-dispatch-gate.test.mjs)
- [2026-11-01 22:07] (status) doing → review
- [2026-11-01 22:07] (landed) 805337a kit-bug-dispatch-gate: a bare T### in a hand-off naming a full KIT-T id resolves to that key (kit-bug-dispatch-gate 24 p
