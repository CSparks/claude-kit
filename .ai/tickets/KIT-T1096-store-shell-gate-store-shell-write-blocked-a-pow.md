---
id: KIT-T1096
title: store-shell-gate (store-shell-write) blocked a PowerShell command in road-generator 2026-11-12 with 'Ambiguous shell quoting' and did not sa
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T16:03:39Z
updated: 2026-11-12T16:18:34Z
fixed_commit: b17bdf3
---

## Description
store-shell-gate (store-shell-write) blocked a PowerShell command in road-generator 2026-11-12 with 'Ambiguous shell quoting' and did not say which token was ambiguous. The command chained: t notes RDG-T015 with a double-quoted prose string containing angle brackets and an arrow; git add of six paths plus .ai; git commit -q -m with a single-quoted here-string; git log, git status, git remote. Nothing wrote the store by hand. Wanted: the block names the offending span, and a t verb plus git add .ai plus a here-string commit message is not treated as a hand write.

kit-bug-shape: cap:bug:store-shell-gate-store-shell-write-blocked-a-pow
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The store-shell-gate block names the ambiguous construct, its position, the text around it and the write word that made it a hit: store-shell-gate.test.mjs 56 passed
- [x] A t verb plus git add of the store plus a PowerShell here-string commit message is not a hand write; a real hand write still blocks: shell-segments.test.mjs 54 passed, store-shell-gate.test.mjs 56 passed

## Plan
1.

## Notes
Cause found by reproduction: a single-quoted here-string body was parsed as shell, so an apostrophe left an unclosed quote and the write words or an arrow in the commit prose made it a hit. Fix: inert-heredoc.mjs cuts a single-quoted here-string given to a data consumer (git, t, cap, q ...); shell-segments.mjs returns ambiguity with reason, position and span; shell-write-scan.mjs passes it and the matched write word to the gate result; store-shell-gate.mjs prints Ambiguous span. A double-quoted here-string, a here-string to a shell and one that never closes stay parsed. Tests: shell-segments 54, store-shell-gate 56, shell-write-scan 54, patch-apply 77, shell-writes 11, source-shell-gate 168 and its escapes 11, wrapped 238, delete 19, touch 113, shell-variables-allowlist 192, query-gate all pass. Not done: source-shell-gate still prints the generic ambiguity text without the span; it can reuse the same fields.

## History
- [2026-11-12 16:03] (created) bug — store-shell-gate (store-shell-write) blocked a PowerShell command in road-generator 2026-11-12 with 'Ambiguous shell quoting' and did not sa
- [2026-11-12 16:15] (comment) criterion added: The store-shell-gate block names the ambiguous construct, its position, the text around it and the write word that made it a hit: store-shell-gate.test.mjs 56 passed
- [2026-11-12 16:15] (comment) criterion added: A t verb plus git add of the store plus a PowerShell here-string commit message is not a hand write; a real hand write still blocks: shell-segments.test.mjs 54 passed, store-shell-gate.test.mjs 56 passed
- [2026-11-12 16:15] (comment) ticked: The store-shell-gate block names the ambiguous construct, its position, the text around it and the write word that made it a hit: store-shell-gate.test.mjs 56 passed
- [2026-11-12 16:15] (comment) ticked: A t verb plus git add of the store plus a PowerShell here-string commit message is not a hand write; a real hand write still blocks: shell-segments.test.mjs 54 passed, store-shell-gate.test.mjs 56 passed
- [2026-11-12 16:16] (landed) b17bdf3 store-shell-gate: a single-quoted here-string given to a data consumer is inert; an ambiguity block names the construct,
- [2026-11-12 16:18] (status) todo → review
