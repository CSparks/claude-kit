---
id: KIT-T934
title: source-shell-gate false positive: a read-only q code --regex command with escaped quotes in the pattern was blocked as a possible source wri
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T939
created: 2026-11-10T15:34:40Z
updated: 2026-11-10T17:33:13Z
---

## Description
source-shell-gate false positive: a read-only q code --regex command with escaped quotes in the pattern was blocked as a possible source write (GG-T201 session, 2026-11-10)

kit-bug-shape: cap:bug:source-shell-gate-false-positive-a-read-only-q-c
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 15:34] (created) bug — source-shell-gate false positive: a read-only q code --regex command with escaped quotes in the pattern was blocked as a possible source wri
- [2026-11-10 17:32] (landed) c14d0f8 source-shell-gate: a node -e one-liner naming a kit script path is no kit verb (the exemption reads only the script node
- [2026-11-10 17:33] (status) todo → superseded (by KIT-T939)
- [2026-11-10 17:33] (comment) @claude: Duplicate of the source-shell-gate false-positive family fixed in c14d0f8 (KIT-T939): in an ambiguous-quoting command, p (full comment #1 in ## Notes)
### comment #1 [2026-11-10 17:33] @claude
Duplicate of the source-shell-gate false-positive family fixed in c14d0f8 (KIT-T939): in an ambiguous-quoting command, pieces led by a kit verb (q, t, cap, node <kit script>) are no longer tested for write tokens; a write behind an operator is still its own piece and blocks.
- [2026-11-10 17:33] (status) superseded → superseded
