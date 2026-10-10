---
id: KIT-T329
title: game-asset-artist agent guidance steers toward a mesh the maintainer rejects on sight. agents/game-asset-artist.md (Low-poly craft, 'Silhoue
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-05T00:10:53Z
updated: 2026-10-05T00:10:53Z
---

## Description
game-asset-artist agent guidance steers toward a mesh the maintainer rejects on sight. agents/game-asset-artist.md (Low-poly craft, 'Silhouette first') says: 'Extruding the front profile and intersecting it with the extruded side profile gives the blocked form in one step.' An opus run in dirt-empire (2026-10-04, 385k tokens, 5 passes) built a truck body exactly that way plus boolean unions: silhouette overlap 0.88-0.95 and checker-clean, but 40% sliver triangles, a zero-length edge, strip-like faces. Chris: 'The entire hood/fenders/etc. should've been box modeled ... weird strips and TONS of thin tris ... utter trash.' Fix in the agent definition: body panels and organic shells are box-modelled (box, loop cuts, vertex moves, extrude/inset, quads kept until triangulation, half + mirror); profile intersection is a measuring aid only, never shipped topology; the Verify section must include triangle quality (sliver share, min-angle, edge-length spread) and a 3D preview of a blockout BEFORE refinement passes.

kit-bug-shape: cap:bug:game-asset-artist-agent-guidance-steers-toward-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-05 00:10] (created) bug — game-asset-artist agent guidance steers toward a mesh the maintainer rejects on sight. agents/game-asset-artist.md (Low-poly craft, 'Silhoue
