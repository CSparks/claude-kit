---
id: KIT-T1138
title: tool-writes accepted-writes ledger loses entries: hooks/lib/tool-writes.mjs:42-50 is a read-modify-write with no lock (the race KIT-T1133 fixed for the session ledger)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T17:19:41Z
updated: 2026-11-13T17:19:41Z
---

## Description
entriesOf(root) reads the accepted-writes ledger slot and writeTurnState(root, { entries: [...entriesOf(root), ...added].slice(-ENTRIES_MAX) }, SLOT) writes it back with no lock. Concurrent writers of one session (parallel subagents, Pre and Post hooks) lose each other's entries, and a lost entry makes the commit-foreign gate (KIT-T407) and hand-write-detect (KIT-T706) flag the agent's own file as foreign. KIT-T1133 (e2e41e4) made the session write ledger append-only; the accepted-writes ledger has the same race and the same remedy. KIT-T1010 noted it only as a residual in its Notes. Reported by the earlier kit agent while landing KIT-T1133. Filed, not fixed (KIT-T1136 agent). kit-bug

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1010, KIT-T1133

## History
- [2026-11-13 17:19] (created) bug — tool-writes accepted-writes ledger loses entries: hooks/lib/tool-writes.mjs:42-50 is a read-modify-write with no lock (the race KIT-T1133 fixed for the session ledger)
