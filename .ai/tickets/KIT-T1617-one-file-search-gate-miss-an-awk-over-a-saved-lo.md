---
id: KIT-T1617
title: one-file-search gate miss: an awk over a saved log (target/w2-moves.txt) in rapid-game ran without a block while grep and sed on named logs
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T22:15:12Z
updated: 2026-11-27T22:32:34Z
---

## Description
one-file-search gate miss: an awk over a saved log (target/w2-moves.txt) in rapid-game ran without a block while grep and sed on named logs were blocked (reported by a town-plan subagent 2026-11-27, alongside KIT-T1616)

kit-bug-shape: cap:bug:one-file-search-gate-miss-an-awk-over-a-saved-lo:603006ba
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-27 22:15] (created) bug — one-file-search gate miss: an awk over a saved log (target/w2-moves.txt) in rapid-game ran without a block while grep and sed on named logs
- [2026-11-27 22:27] (landed) 803e14d2 one-file-search: an awk over a saved log is refused whatever its program, and gawk, mawk and nawk are judged as awk; age
- [2026-11-27 22:28] (comment) @claude: fixed 803e14d2: the missed command was awk '{print $6, $7}' target/w2-moves.txt | sort | uniq -c (a field print, no rege (full comment #1 in ## Notes)
### comment #1 [2026-11-27 22:28] @claude
fixed 803e14d2: the missed command was awk '{print $6, $7}' target/w2-moves.txt | sort | uniq -c (a field print, no regex); any awk-family program over a saved log or build output now blocks, a regex pattern over any named file blocks, gawk/mawk/nawk judged as awk; a field print of a source or data file still passes (existing control)
- [2026-11-27 22:32] (status) todo → review
