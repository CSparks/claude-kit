---
id: KIT-T380
title: q gap: 'code' has no -n flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-07T01:18:13Z
updated: 2026-10-20T00:53:15Z
fixed_commit: b6dd07f
---

## Description
q code ARENA_BYTES|RG_POOLED_INSTANCES|InstanceUploadMode|PooledInstancesPlugin --regex -n

kit-bug-shape: q-gap:flag:code:-n
first seen in rapid-game. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 01:18] (created) bug — q gap: 'code' has no -n flag
- [2026-10-08 00:09] (comment) seen again in claude-kit: q code fts --path scripts/q-lib.mjs -n
- [2026-10-13 19:47] (comment) seen again in claude-kit: q code sessionId --path scripts -n
- [2026-10-17 21:01] (comment) seen again in rapid-game: q code fs::write|std::fs::write|File::create|set_modified|OpenOptions --lang rust -n
- [2026-10-19 03:07] (comment) seen again in dirt-empire: q code surface_material --lang rust -n
- [2026-10-19 17:09] (comment) seen again in dirt-empire: q code Val::Px --lang rust --path crates/dirt-empire -n
- [2026-10-19 22:58] (comment) seen again in claude-kit: q code x --path scripts/q.mjs -n
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) q code accepts -n -r -H (no-ops); test scripts/q-gaps.test.mjs
