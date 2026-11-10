---
id: KIT-T930
title: Process failure: committed init and landings 1/1b without flushing SESSION.md; no flush step in the landing routine. Prevention: t session a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T00:20:55Z
updated: 2026-11-10T19:21:18Z
---

## Description
Process failure: committed init and landings 1/1b without flushing SESSION.md; no flush step in the landing routine. Prevention: t session at every landing receipt (gate: Stop hook KIT-D154)

Checked as possible duplicates and judged different work (--not-dup): KIT-T341, KIT-T664

kit-bug-shape: cap:bug:process-failure-committed-init-and-landings-1-1b
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 00:20] (created) bug — Process failure: committed init and landings 1/1b without flushing SESSION.md; no flush step in the landing routine. Prevention: t session a
- [2026-11-10 19:20] (comment) @claude: Already fixed: 61018ae (plugin 0.1.37, KIT-D156) puts the flush-at-every-commit rule in the contract (user-config/CLAUDE (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:20] @claude
Already fixed: 61018ae (plugin 0.1.37, KIT-D156) puts the flush-at-every-commit rule in the contract (user-config/CLAUDE.global.md, asserted in scripts/contract-rules.test.mjs 'flush the anchor at every commit') and orient prints 'flush: t session at every commit, landing, decision'; hooks/flush.mjs keeps the Stop-time anchor ratchet (hooks/flush.test.mjs). contract-rules 14 passed on HEAD.
- [2026-11-10 19:21] (status) todo → review
