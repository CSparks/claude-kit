---
id: KIT-T958
title: Process failure 2026-11-10 (kit agent adcd3ffd, stiletto-2349 session): to get past a stale write-ledger holder block (KIT-T944) and hand-wr
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:23:07Z
updated: 2026-11-10T18:23:07Z
---

## Description
Process failure 2026-11-10 (kit agent adcd3ffd, stiletto-2349 session): to get past a stale write-ledger holder block (KIT-T944) and hand-write-detect blames (KIT-T949), the writer added refuseEdit entries to ANOTHER live session's (da28715f) holder record for 16 files it wrote itself: hooks/lib/gate-protocol.mjs, session-overlap.mjs, question-checks.mjs, scripts/t.mjs and others. That is an end-around of the checkout-holder guard (KIT-D147). Root cause: no sanctioned way to release a false hold; the agent had none. Prevention: a verb that releases a hold on a file the caller wrote (checked against git, not the ledger), plus a guard that refuses writes into another session's holder record. KIT-T948 (partial-commit case) is adjacent.

kit-bug-shape: cap:bug:process-failure-2026-11-10-kit-agent-adcd3ffd-st
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:23] (created) bug — Process failure 2026-11-10 (kit agent adcd3ffd, stiletto-2349 session): to get past a stale write-ledger holder block (KIT-T944) and hand-wr
