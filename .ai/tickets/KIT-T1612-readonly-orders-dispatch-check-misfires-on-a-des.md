---
id: KIT-T1612
title: readonly-orders dispatch check misfires on a descriptive mention: a brief to claude-kit:analyst saying 'Today cargo r builds these into the
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T19:19:52Z
updated: 2026-11-27T19:19:52Z
---

## Description
readonly-orders dispatch check misfires on a descriptive mention: a brief to claude-kit:analyst saying 'Today cargo r builds these into the maintainer's game' was blocked as an order to run cargo; context sentences that describe what a command does are not orders

kit-bug-shape: cap:bug:readonly-orders-dispatch-check-misfires-on-a-des:d5ac9d9d
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed narrowly: a command that is the subject of a describing present-tense verb (builds, produces, prints, runs ...; flags between allowed) is no order, unless a run word stands right before it or the clause asks to verify it (check, confirm, verify, ensure, make sure). Every earlier order fixture still blocks; new orders added (run cargo r beside the described sentence, check that cargo r builds, confirm cargo test passes). Not done: a full rewrite to imperative-only recognition, since 'Verify with cargo check -p x.' and 'Step 2: cargo test ...' are orders with no run verb and would flip, loosening how a real order is read. hooks/dispatch-readonly-orders.test.mjs 80 passed.

## History
- [2026-11-27 19:19] (created) bug — readonly-orders dispatch check misfires on a descriptive mention: a brief to claude-kit:analyst saying 'Today cargo r builds these into the
- [2026-11-27 19:34] (landed) d20c6473 readonly-orders: a command that is the subject of a describing verb ("Today cargo r builds these into the maintainer's g
