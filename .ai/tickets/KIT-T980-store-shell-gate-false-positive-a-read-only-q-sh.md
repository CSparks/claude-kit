---
id: KIT-T980
title: store-shell gate false-positive: a read-only 'q show <id> | sed | grep' pipeline is blocked as a shell read of .ai/ even though q show is th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T22:46:10Z
updated: 2026-11-10T23:01:13Z
---

## Description
store-shell gate false-positive: a read-only 'q show <id> | sed | grep' pipeline is blocked as a shell read of .ai/ even though q show is the sanctioned read path

kit-bug-shape: cap:bug:store-shell-gate-false-positive-a-read-only-q-sh
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed 2026-11-10. The gate that blocked was query-gate (check store-grep), NOT store-shell-gate (a write gate; it passed all five repro commands). Root cause: readsItemFile treated every token of a sed segment as a file operand, and the sed script /Notes/,/History/p matched STORE (notes/, case-insensitive) and ITEM_PATH, so the segment counted as an item-file read and the piped grep after it was judged a store search. Fix: hooks/lib/store-search.mjs fileOperands() drops flags and the first positional of grep/sed/awk (the script or pattern, unless -e/-f/--expression/--file); hooks/query-gate.mjs readsItemFile tokenises quote-aware and uses it. Evidence: hooks/query-gate.test.mjs 127 passed incl. 5 KIT-T980 cases (3 pass, 2 controls still block); hooks/store-shell-gate.test.mjs 40 passed; live from D:/dev/marblequest the original q show | sed | grep pipelines draw no block. KIT-T733 and KIT-T792 (source-shell-gate) and KIT-T734 (broker-wait-gate) were not folded in: different gates and causes, already fixed (a719628, a315e09, abbbc1a).

## History
- [2026-11-10 22:46] (created) bug — store-shell gate false-positive: a read-only 'q show <id> | sed | grep' pipeline is blocked as a shell read of .ai/ even though q show is th
- [2026-11-10 23:01] (status) todo → review
- [2026-11-10 23:01] (landed) 00d0557 query-gate: a piped sed script such as /Notes/,/History/p is not an item file, so q show | sed | grep passes; tests (imp
