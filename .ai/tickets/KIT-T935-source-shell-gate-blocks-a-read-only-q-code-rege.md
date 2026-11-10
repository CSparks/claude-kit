---
id: KIT-T935
title: source-shell-gate blocks a read-only q code --regex command whose pattern has escaped double quotes (ambiguous quoting treated as a possible
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T939
created: 2026-11-10T15:39:49Z
updated: 2026-11-10T17:33:15Z
---

## Description
source-shell-gate blocks a read-only q code --regex command whose pattern has escaped double quotes (ambiguous quoting treated as a possible source write)

kit-bug-shape: cap:bug:source-shell-gate-blocks-a-read-only-q-code-rege
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 15:39] (created) bug — source-shell-gate blocks a read-only q code --regex command whose pattern has escaped double quotes (ambiguous quoting treated as a possible
- [2026-11-10 17:32] (landed) c14d0f8 source-shell-gate: a node -e one-liner naming a kit script path is no kit verb (the exemption reads only the script node
- [2026-11-10 17:33] (status) todo → superseded (by KIT-T939)
- [2026-11-10 17:33] (comment) @claude: Same family as KIT-T934; fixed in c14d0f8 (KIT-T939).
- [2026-11-10 17:33] (status) superseded → superseded
