---
id: KIT-T590
title: patch-worker: running a framework script from the broker-owned tree (headless Blender importing rapid-game/scripts/blender/blend_to_rhai.py)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T22:42:24Z
updated: 2026-10-20T00:52:58Z
fixed_commit: b6dd07f
---

## Description
patch-worker: running a framework script from the broker-owned tree (headless Blender importing rapid-game/scripts/blender/blend_to_rhai.py) writes __pycache__ into the tree; nothing warns, and the agent removed it with rm -rf outside the broker. Need PYTHONDONTWRITEBYTECODE guidance or a scratch-copy rule in the skill

kit-bug-shape: cap:bug:patch-worker-running-a-framework-script-from-the
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 22:42] (created) bug — patch-worker: running a framework script from the broker-owned tree (headless Blender importing rapid-game/scripts/blender/blend_to_rhai.py)
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) patch-worker skill and agent: run framework scripts from a scratchpad copy or with PYTHONDONTWRITEBYTECODE=1; broker builds now set it; broker.mjs clean removes strays; tests scripts/broker/clean.test.mjs (4 passed)
