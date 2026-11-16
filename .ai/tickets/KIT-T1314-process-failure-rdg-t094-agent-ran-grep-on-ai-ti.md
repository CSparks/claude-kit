---
id: KIT-T1314
title: process failure RDG-T094 agent ran grep on .ai/tickets despite the brief saying q show or Read only; store-grep gate blocked it. Prevention:
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T16:04:16Z
updated: 2026-11-16T16:17:20Z
---

## Description
process failure RDG-T094 agent ran grep on .ai/tickets despite the brief saying q show or Read only; store-grep gate blocked it. Prevention: the fix-agent brief template should name the q show + node scan pattern for ticket Notes (a long ticket read goes q show > file then Read/node scan)

kit-bug-shape: cap:bug:process-failure-rdg-t094-agent-ran-grep-on-ai-ti:6edd193a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Already covered after KIT-T1311: the first-hit store block names q fts <terms> (--any for an alternation) and q show <id> (exact for an item path). Probed 20 forms against the gate: uncovered were (1) a recursive grep with --include over the bare .ai directory, (2) the Grep tool or rg with a glob over the store and no path, (3) the Grep tool with path .ai, (4) grep of a named item after 'cd .ai/tickets', (5) 'cd .ai && grep -rn x tickets' (blocked, but named q code --path). Fixed in hooks/query-gate.mjs: bare .ai counts as the store, glob option values scope a search like a path, a cd into .ai makes relative operands store paths, and the block adds 'q show <id> > <scratch file>, then Read it' for a long item. Passing by design: sed -n line-range of one item, a named non-store file, a grep of a scratch file. Tests: hooks/query-gate.test.mjs all pass (8 new, KIT-T1314); git-search 49, search-adoption 7, store-shell-gate 66, hand-write-detect 73, block-triage, index-redirect, query-gate-pipes/-tool/-variables, search-telemetry exit 0.

## History
- [2026-11-16 16:04] (created) bug — process failure RDG-T094 agent ran grep on .ai/tickets despite the brief saying q show or Read only; store-grep gate blocked it. Prevention:
- [2026-11-16 16:17] (status) todo → review
