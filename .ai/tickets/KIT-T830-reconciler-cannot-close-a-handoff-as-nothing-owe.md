---
id: KIT-T830
title: reconciler cannot close a handoff as nothing owed, and attributes a handoff to every ticket the brief cites (dirt-empire 2026-11-02, worker abda8e03945cd9b43 DE-T254/DE-T245)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T17:22:29Z
updated: 2026-11-02T17:22:52Z
---

## Description
Worker abda8e03945cd9b43 (DE-T254 measure job) found no problem and stopped by design; the Stop gate still said RETIRED WITH HANDOFF for DE-T254 and for DE-T245 (only cited as disjoint paths). ack.mjs --agent acked 0 jobs, nothing cleared the row. Fix: a handoff closes when its Next says stop/nothing owed or when ack.mjs --handoff <agent> --reason records 'no successor owed' as a ticket comment; a handoff is attributed only to the tickets the task label names (fallback: all cited).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T718, KIT-T818, KIT-T821
Fix: hooks/lib/successor.mjs handoffClosed (Next says stop/none/nothing owed, or a ticket comment 'no successor owed [agent id8]: reason') and dispatchedTickets (tickets the task label names, else every cited ticket), used by hooks/lib/handback.mjs workItems and pendingSuccessors; scripts/broker/handoff-close.mjs and ack.mjs --handoff <agent> --reason <why> [--ticket id] write the comment via t comment. The gate text names the command. Tests: hooks/handoff-close.test.mjs 10 passed (control: a real open handoff still blocks; Next 'stop the daemon first' still blocks; another agent's close and a close without a reason do not clear; a merely mentioned ticket is not owed), successor-gate 16, handback 36, orient 34, agent-context 37 passed.

## History
- [2026-11-02 17:22] (created) bug — reconciler cannot close a handoff as nothing owed, and attributes a handoff to every ticket the brief cites (dirt-empire 2026-11-02, worker abda8e03945cd9b43 DE-T254/DE-T245)
- [2026-11-02 17:22] (status) todo → review
- [2026-11-02 17:23] (landed) beb8b5f Reconciler: a handoff closes as nothing owed (Next says stop, or ack.mjs --handoff records it on the ticket) and a worke
