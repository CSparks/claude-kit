---
id: KIT-T414
title: Process failure (DE-T113, 2026-10-09/10): a Steam Deck framerate bug was 'fixed' three times (1969916, 3aa02b8, 1885293) on offline mesh/tri
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T14:53:09Z
updated: 2026-10-10T14:53:09Z
---

## Description
Process failure (DE-T113, 2026-10-09/10): a Steam Deck framerate bug was 'fixed' three times (1969916, 3aa02b8, 1885293) on offline mesh/triangle counts computed on Windows; no frame time was ever captured on the Deck although orient lists ssh access + deck-deploy.mjs. Root cause: no gate ties a device-reported perf bug to a measurement ON THAT DEVICE before review; the perf-tuner/perf-engineer agent (KIT-T377/T399) was never used. Fix: a ticket whose title names a device cannot reach review without a measurement artifact from that device cited in Notes

kit-bug-shape: cap:bug:process-failure-de-t113-2026-10-09-10-a-steam-de
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 14:53] (created) bug — Process failure (DE-T113, 2026-10-09/10): a Steam Deck framerate bug was 'fixed' three times (1969916, 3aa02b8, 1885293) on offline mesh/tri
