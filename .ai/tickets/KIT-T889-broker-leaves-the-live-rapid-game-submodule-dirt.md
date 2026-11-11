---
id: KIT-T889
title: Broker leaves the live rapid-game submodule dirty after an undone land, then refuses the next pin: 'pin: rapid-game has uncommitted changes'
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T18:59:19Z
updated: 2026-11-07T18:59:19Z
---

## Description
Broker leaves the live rapid-game submodule dirty after an undone land, then refuses the next pin: 'pin: rapid-game has uncommitted changes' (job j-mw6rihpb-neuph6, dirt-empire). State seen 2026-11-07: git diff --stat shows only rust/Cargo.lock changed (1+/10-); eight rg-physics files (lane/balanced.rs, streaming/balance.rs, wheeled/balance.rs, tests streaming_balance, wheeled_bails_fallen, wheeled_cores, wheeled_pull) show M with no content diff (LF/CRLF only). Follows the undone land j-mw6qk2zj-dz9tkm (refs/broker/undone/j-mw6qk2zj-dz9tkm-4674aa981c). Broker must restore the live submodule exactly after an undone land (including line endings and lock), and the pin step should name which file is dirty.

kit-bug-shape: cap:bug:broker-leaves-the-live-rapid-game-submodule-dirt
first seen in rapid-game. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 18:59] (created) bug — Broker leaves the live rapid-game submodule dirty after an undone land, then refuses the next pin: 'pin: rapid-game has uncommitted changes'
