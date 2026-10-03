---
id: KIT-T313
title: structure-audit name-doubling detection only checks src/<crate>/ and <dir>/<dir>/ (scripts/structure-audit.mjs:45-50), so it misses a folder
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T18:41:28Z
updated: 2026-10-03T18:42:53Z
---

## Description
structure-audit name-doubling detection only checks src/<crate>/ and <dir>/<dir>/ (scripts/structure-audit.mjs:45-50), so it misses a folder or module file anywhere inside a crate's src that repeats the crate name (minus rg-), e.g. crates/materials/src/render/materials/, crates/terrain/src/scene/terrain/, bay/src/screens/bay/, hud/src/screens/hud/, combat/src/scene/combat/, sim/src/sim.rs, rg-engine/src/engine.rs. Detect at any depth, including module files named after the crate.

kit-bug-shape: cap:feature:structure-audit-name-doubling-detection-only-che
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] name-doubling flags a folder or module file at any depth under a crate's src named after the crate (minus rg-, - as _)

## Plan
1.

## History
- [2026-10-03 18:41] (created) feature — structure-audit name-doubling detection only checks src/<crate>/ and <dir>/<dir>/ (scripts/structure-audit.mjs:45-50), so it misses a folder
- [2026-10-03 18:42] (comment) criterion added: name-doubling flags a folder or module file at any depth under a crate's src named after the crate (minus rg-, - as _)
- [2026-10-03 18:42] (comment) ticked: name-doubling flags a folder or module file at any depth under a crate's src named after the crate (minus rg-, - as _)
- [2026-10-03 18:42] (comment) @sonnet55: crateNameRepeats in scripts/structure-audit.mjs walks every dir under crate/src. Tests: scripts/structure-audit.test.mjs (full comment #1 in ## Notes)
### comment #1 [2026-10-03 18:42] @sonnet55
crateNameRepeats in scripts/structure-audit.mjs walks every dir under crate/src. Tests: scripts/structure-audit.test.mjs (14 passed): flags render/materials, scene/terrain, sim/src/sim.rs, rg-engine/src/engine.rs; negative control: different-named sibling folder/file and lib.rs unflagged. Mutation (drop crateNameRepeats) fails the positive test.
- [2026-10-03 18:42] (status) todo → review
