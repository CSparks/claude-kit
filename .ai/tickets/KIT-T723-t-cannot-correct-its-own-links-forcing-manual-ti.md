---
id: KIT-T723
title: t cannot correct its own links, forcing manual ticket edits (2026-10-30, KIT-T487/T720 agent): 't link T720 superseded_by T487' wrote the su
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T04:26:32Z
updated: 2026-10-30T04:35:04Z
fixed_commit: b88590e
---

## Description
t cannot correct its own links, forcing manual ticket edits (2026-10-30, KIT-T487/T720 agent): 't link T720 superseded_by T487' wrote the supersede link in BOTH directions, there is no 't unlink' / link-replace, and 't status done' demanded --fixed-commit without saying how; the agent fell back to Edit, then a scratchpad script, on .ai/tickets files. Per the new decision (all ticket maintenance through KIT, no manual edits): fix t link directionality, add t unlink (or replace), and add a gate that blocks Edit/Write and shell writes to .ai/<items> files outside t/cap, naming the t command to use.

kit-bug-shape: cap:bug:t-cannot-correct-its-own-links-forcing-manual-ti
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-30 04:26] (created) bug — t cannot correct its own links, forcing manual ticket edits (2026-10-30, KIT-T487/T720 agent): 't link T720 superseded_by T487' wrote the su
- [2026-10-30 04:34] (landed) b88590e t link writes forward+inverse per relation, t unlink removes both sides, fixed-commit warning names the command, store-w
- [2026-10-30 04:35] (status) todo → review
- [2026-10-30 04:35] (comment) t link direction verified correct (tests lock it); t unlink added; fixed-commit message names the command; store-write gate now refuses Edit/Write of an existing item. See commit b88590e.
