---
id: KIT-T955
title: dispatch-guard lessons-checked + conformance-named misfire on a module path word: a race/physics brief citing rapid-game/rust/engine/rg-phys
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:14:43Z
updated: 2026-11-10T18:17:08Z
---

## Description
dispatch-guard lessons-checked + conformance-named misfire on a module path word: a race/physics brief citing rapid-game/rust/engine/rg-physics/src/streaming/** (the physics world module, PhysicsWorld) was blocked as 'touches rendering, performance, assets or streaming'. The gate keys on the token 'streaming' anywhere in the brief, including a crate-internal module path. It should ignore path tokens inside a crate's src/ that name a module, or match only asset/render streaming phrases (stream ring, upload, reveal, chunk streaming).

kit-bug-shape: cap:bug:dispatch-guard-lessons-checked-conformance-named
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 5bdc689; tests hooks/dispatch-lessons.test.mjs and dispatch-conformance.test.mjs (physics path passes, real streaming brief and bare 'streaming' still block)

## History
- [2026-11-10 18:14] (created) bug — dispatch-guard lessons-checked + conformance-named misfire on a module path word: a race/physics brief citing rapid-game/rust/engine/rg-phys
- [2026-11-10 18:17] (status) todo → review
