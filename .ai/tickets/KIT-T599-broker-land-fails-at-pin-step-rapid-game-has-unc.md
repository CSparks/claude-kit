---
id: KIT-T599
title: broker: land fails at pin step 'rapid-game has uncommitted changes' - rust/Cargo.lock carries a 7-line rg-vehicle entry left by killed daemo
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T598
created: 2026-10-20T01:26:33Z
updated: 2026-10-20T01:26:33Z
---

## Description
broker: land fails at pin step 'rapid-game has uncommitted changes' - rust/Cargo.lock carries a 7-line rg-vehicle entry left by killed daemons (KIT-T596 stall loop). broker clean removes only untracked files; nothing restores tracked files in the submodule. Need: broker clean/restore for tracked debris in submodules, and the root cause (a job killed mid-job leaves Cargo.lock edits). Found by bike agent on DE-T172 L4a land j-mvfzons0-x12hyh.

kit-bug-shape: cap:bug:broker-land-fails-at-pin-step-rapid-game-has-unc
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
2026-10-20: duplicate of KIT-T598 (superseded); fixed by restore.mjs, published 84821fa.

## History
- [2026-10-20 01:26] (created) bug — broker: land fails at pin step 'rapid-game has uncommitted changes' - rust/Cargo.lock carries a 7-line rg-vehicle entry left by killed daemo
- [2026-10-20 02:06] (status) → superseded (by KIT-T598)
