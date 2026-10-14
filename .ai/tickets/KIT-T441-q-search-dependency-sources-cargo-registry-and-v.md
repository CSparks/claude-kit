---
id: KIT-T441
title: q: search dependency sources (~/.cargo/registry and vendored crates) — the RG-T003 analyst needed avian3d/bevy_rapier3d/rapier3d API names a
type: feature
status: superseded
priority: critical
asked: 3
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by: KIT-T392
created: 2026-10-13T06:45:45Z
updated: 2026-10-13T06:48:12Z
---

## Description
q: search dependency sources (~/.cargo/registry and vendored crates) — the RG-T003 analyst needed avian3d/bevy_rapier3d/rapier3d API names and force-clearing semantics and had to grep ~/.cargo/registry because q only indexes the repo and its submodule. A --deps or --registry scope on q code/sym would close it.

kit-bug-shape: cap:feature:q-search-dependency-sources-cargo-registry-and-v
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 06:45] (created) feature — q: search dependency sources (~/.cargo/registry and vendored crates) — the RG-T003 analyst needed avian3d/bevy_rapier3d/rapier3d API names a
- [2026-10-13 06:47] (comment) seen again in stiletto-2349: q: search dependency sources (~/.cargo/registry and vendored crates). The RG-T003 analyst needed avian3d / bevy_rapier3d / rapier3d API names and force-clearing semantics and had to grep ~/.cargo/registry because q indexes only the repo and its submodule. A --deps or --registry scope on q code/sym w
- [2026-10-13 06:47] (asked again) 2026-10-13 — cap:feature:q-search-dependency-sources-cargo-registry-and-v
- [2026-10-13 06:47] (comment) seen again in stiletto-2349: q: search dependency sources (~/.cargo/registry and vendored crates); the RG-T003 analyst had to grep the registry for avian3d/bevy_rapier3d/rapier3d API names
- [2026-10-13 06:47] (asked again) 2026-10-13 — cap:feature:q-search-dependency-sources-cargo-registry-and-v
- [2026-10-13 06:48] (status) → superseded (by KIT-T392)
- [2026-10-13 06:48] (status) superseded → superseded
