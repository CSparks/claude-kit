---
id: KIT-T422
title: Process failure 2026-10-10 (dirt-empire): a menu rewrite (DE-T125) and a barrier redesign (DE-T118) shipped to the Deck on headless lint/swe
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-11T04:06:14Z
updated: 2026-10-11T04:06:14Z
---

## Description
Process failure 2026-10-10 (dirt-empire): a menu rewrite (DE-T125) and a barrier redesign (DE-T118) shipped to the Deck on headless lint/sweep evidence alone; nobody captured the real window, and the first look was Chris's ('menu STILL fucked', 'barriers completely FUCKED'). Root cause: the 'screenshots are not evidence' rule was read as 'never capture'; it means Claude cannot JUDGE pixels — the maintainer can, so every UI/asset/placement landing must ship a device capture TO the maintainer (SendUserFile) with the landing receipt, and Claude may use a capture to catch gross failure (wrong scale, duplicate UI, giant geometry). Fix: land-alert gate requires a capture path/receipt for tickets labelled ui/asset/visual; the capture-and-send step becomes a kit skill (deck-capture) used by the writer before review

kit-bug-shape: cap:bug:process-failure-2026-10-10-dirt-empire-a-menu-re
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-11 04:06] (created) bug — Process failure 2026-10-10 (dirt-empire): a menu rewrite (DE-T125) and a barrier redesign (DE-T118) shipped to the Deck on headless lint/swe
