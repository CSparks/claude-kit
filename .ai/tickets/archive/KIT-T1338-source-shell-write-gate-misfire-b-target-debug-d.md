---
id: KIT-T1338
title: source-shell-write gate misfire: 'B=target/debug/deps/x.exe; cp $B target/engine-head.exe' blocked as a source write; cp writes only its LAS
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1165]
files: []
supersedes:
superseded_by:
created: 2026-11-17T07:43:46Z
updated: 2026-11-17T09:07:30Z
---

## Description
source-shell-write gate misfire: 'B=target/debug/deps/x.exe; cp $B target/engine-head.exe' blocked as a source write; cp writes only its LAST operand (a non-source path under target/), the gate judged the unresolved source operand $B. Also: gate should allow cp whose destination is under target/ or a scratch dir.

kit-bug-shape: cap:bug:source-shell-write-gate-misfire-b-target-debug-d:9e49e7bf
first seen in rust. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-17 07:43] (created) bug — source-shell-write gate misfire: 'B=target/debug/deps/x.exe; cp $B target/engine-head.exe' blocked as a source write; cp writes only its LAS
- [2026-11-17 08:57] (landed) 7fc1d2c4 restore-tree: bisecting by path restore is safe end to end (implements KIT-T1340, KIT-T1338)
- [2026-11-17 09:07] (comment) @claude: Not a duplicate of KIT-T1165 (that was an unresolved cp DESTINATION behind an && chain; this is an unresolved cp SOURCE  (full comment #1 in ## Notes)
### comment #1 [2026-11-17 09:07] @claude
Not a duplicate of KIT-T1165 (that was an unresolved cp DESTINATION behind an && chain; this is an unresolved cp SOURCE with a literal destination under target/). It does not reproduce at head 69469974: B=target/debug/probe.exe; cp $B target/engine-head.exe and the && form both pass source-shell-gate, a variable source copied onto a literal repo source path and onto a variable destination under src stay blocked (hooks/source-shell-gate-chained.test.mjs 16 passed, 3 cases added in 7fc1d2c4). Fixing commit not identified (not bisected). Closed with KIT-T1340.
- [2026-11-17 09:07] (status) todo → done
