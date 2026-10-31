---
id: KIT-T768
title: kit-bug-dispatch-gate blocks a session's Stop for a kit ticket another session's live standing kit agent already owns (dirt-empire-83 blocke
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T16:26:58Z
updated: 2026-10-31T16:33:28Z
---

## Description
kit-bug-dispatch-gate blocks a session's Stop for a kit ticket another session's live standing kit agent already owns (dirt-empire-83 blocked on KIT-T767, owned by infra-09's kit agent); dispatching its own would make two writers in claude-kit (KIT-D077). The gate should count a ticket as dispatched when any session's live kit agent claims it (roster row or claim/assignee), and KIT-D094's one-agent-per-session rule needs a carve-out when another session's kit agent holds the checkout

kit-bug-shape: cap:bug:kit-bug-dispatch-gate-blocks-a-session-s-stop-fo
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix: a ticket doing and touched within 4 h counts as claimed by a live kit agent of any session (kit-bug.mjs claimed()); an older doing ticket lists as open again. Evidence: hooks/kit-bug-dispatch-gate.test.mjs 14 passed, scripts/kit-bug.test.mjs 20 ok. Decision draft KIT-D123 (assistant-proposed, pending confirmation).

## History
- [2026-10-31 16:26] (created) bug — kit-bug-dispatch-gate blocks a session's Stop for a kit ticket another session's live standing kit agent already owns (dirt-empire-83 blocke
- [2026-10-31 16:33] (status) todo → doing
