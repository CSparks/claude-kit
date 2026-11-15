---
id: KIT-T1247
title: process failure (houses agent a70f54bfd9ae58e5d, 2026-11-15): edited roof_items.rs to use tone::PLANT_SCREEN before adding it to palette.rs;
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T1245
created: 2026-11-15T08:57:32Z
updated: 2026-11-15T08:57:32Z
---

## Description
process failure (houses agent a70f54bfd9ae58e5d, 2026-11-15): edited roof_items.rs to use tone::PLANT_SCREEN before adding it to palette.rs; the palette edit was then held by another writer's build, leaving rg-buildings uncompilable for several minutes and blocking five agents. Root cause: edits ordered use-before-definition across two files. Prevention: add a definition before its use in the same message, and cargo check the crate after every message that edits it (coordinator's rule).

kit-bug-shape: cap:bug:process-failure-houses-agent-a70f54bfd9ae58e5d-2:dfe7c285
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-15 08:57] (created) bug — process failure (houses agent a70f54bfd9ae58e5d, 2026-11-15): edited roof_items.rs to use tone::PLANT_SCREEN before adding it to palette.rs;
- [2026-11-15 09:14] (status) todo → superseded (by KIT-T1245)
- [2026-11-15 09:14] (status) superseded → superseded (by KIT-T1245)
