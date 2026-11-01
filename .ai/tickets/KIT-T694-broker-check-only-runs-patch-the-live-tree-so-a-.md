---
id: KIT-T694
title: broker check-only runs patch the LIVE tree, so a maintainer's 'cargo run' (even in its own target dir) can compile an agent's unlanded chang
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T00:39:47Z
updated: 2026-10-29T00:39:47Z
---

## Description
broker check-only runs patch the LIVE tree, so a maintainer's 'cargo run' (even in its own target dir) can compile an agent's unlanded change: dirt-empire 2026-10-29 00:35Z rapid-game had 5 modified rg-roads files from a DE-T205 check while Chris was about to build. A play/UAT build needs a clean HEAD view (e.g. broker-provided 'play' snapshot built from HEAD, or check-only runs applied out of the live tree).

kit-bug-shape: cap:bug:broker-check-only-runs-patch-the-live-tree-so-a-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 00:39] (created) bug — broker check-only runs patch the LIVE tree, so a maintainer's 'cargo run' (even in its own target dir) can compile an agent's unlanded chang
