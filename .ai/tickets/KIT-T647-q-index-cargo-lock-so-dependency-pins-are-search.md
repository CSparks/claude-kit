---
id: KIT-T647
title: q: index Cargo.lock so dependency pins are searchable (design agent had to grep Cargo.lock for bevy_gltf/gltf presence, 2026-10-26)
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T04:21:37Z
updated: 2026-10-27T21:33:41Z
---

## Description
q: index Cargo.lock so dependency pins are searchable (design agent had to grep Cargo.lock for bevy_gltf/gltf presence, 2026-10-26)

kit-bug-shape: cap:feature:q-index-cargo-lock-so-dependency-pins-are-search
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code/sym find a crate's pin in Cargo.lock

## Plan
1.

## Notes
2026-10-27 Cargo.lock is now indexed (kind config, lang toml; npm/yarn/pnpm lockfiles stay skipped): q code 'name = "gltf"' -C 1 shows the pinned version, q sym <crate> --type package lists crate+version (scope column). Verified from stiletto-2349: q sym gltf -> Cargo.lock:3476 1.4.1; q sym bevy_gltf -> no results (absent from the lock). Tests: scripts/code-index.test.mjs 26 passed (classify, lockPackages symbols, q code/sym end to end, package-lock negative control), q 112, q-gaps 10, q-server 8, kit-bug 18, q-registry 13. A publish would ship Cargo.lock search to every session; the resident q server picks it up on restart.

## History
- [2026-10-27 04:21] (created) feature — q: index Cargo.lock so dependency pins are searchable (design agent had to grep Cargo.lock for bevy_gltf/gltf presence, 2026-10-26)
- [2026-10-27 21:33] (comment) criterion added: q code/sym find a crate's pin in Cargo.lock
- [2026-10-27 21:33] (comment) ticked: q code/sym find a crate's pin in Cargo.lock
- [2026-10-27 21:33] (status) todo → review
