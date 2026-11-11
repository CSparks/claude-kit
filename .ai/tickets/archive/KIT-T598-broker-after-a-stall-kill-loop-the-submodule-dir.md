---
id: KIT-T598
title: broker: after a stall-kill loop the submodule (dirt-empire/rapid-game) was left with a tracked modification (rust/Cargo.lock +rg-vehicle ent
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes: KIT-T599
superseded_by:
created: 2026-10-20T01:26:06Z
updated: 2026-11-08T16:31:31Z
fixed_commit: 84821fa
---

## Description
broker: after a stall-kill loop the submodule (dirt-empire/rapid-game) was left with a tracked modification (rust/Cargo.lock +rg-vehicle entry from a pinned job); later pinned jobs fail 'rapid-game has uncommitted changes' and 'broker clean' refuses tracked files, so a patch worker has no sanctioned restore (2026-10-20, job j-mvfzons0-x12hyh)

kit-bug-shape: cap:bug:broker-after-a-stall-kill-loop-the-submodule-dir
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-20 01:26] (created) bug — broker: after a stall-kill loop the submodule (dirt-empire/rapid-game) was left with a tracked modification (rust/Cargo.lock +rg-vehicle ent
- [2026-10-20 03:09] (status) todo → review
- [2026-10-20 03:09] (comment) broker.mjs restore <path>|--debris and an automatic restore at the pin step (scripts/broker/restore.mjs); tests scripts/broker/restore.test.mjs 5 passed; published 84821fa; D:/dev/dirt-empire/rapid-game/rust/Cargo.lock restored through 'broker.mjs restore --debris' (2026-10-20)
- [2026-11-08 16:31] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
