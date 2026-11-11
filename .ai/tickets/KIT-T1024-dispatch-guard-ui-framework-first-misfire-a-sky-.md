---
id: KIT-T1024
title: dispatch-guard ui-framework-first misfire: a sky/clouds shader brief (rg-graphics sky/clouds.rs, sky.wgsl, pixel-probe tests, 'frame cost')
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:22:18Z
updated: 2026-11-11T06:30:13Z
---

## Description
dispatch-guard ui-framework-first misfire: a sky/clouds shader brief (rg-graphics sky/clouds.rs, sky.wgsl, pixel-probe tests, 'frame cost') was blocked as 'this brief sizes or lays out UI'. No UI is involved; the trigger is likely words like 'frame', 'edge', 'coverage' or 'top-to-base'. Match UI layout intent (HUD, menu, widget, node, font, padding, layout) instead.

kit-bug-shape: cap:bug:dispatch-guard-ui-framework-first-misfire-a-sky-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:22] (created) bug — dispatch-guard ui-framework-first misfire: a sky/clouds shader brief (rg-graphics sky/clouds.rs, sky.wgsl, pixel-probe tests, 'frame cost')
- [2026-11-11 06:26] (landed) 47844e4 fix: ui-framework-first ignores rendering briefs (sky, shader, pixel probes): loose sizing words drop in a graphics cont
- [2026-11-11 06:30] (comment) @claude: Fixed 47844e4 (pushed main): hooks/dispatch-ui.mjs CONTEXTS table; a rendering-vocabulary brief (shader, wgsl, sky, clou (full comment #1 in ## Notes)
### comment #1 [2026-11-11 06:30] @claude
Fixed 47844e4 (pushed main): hooks/dispatch-ui.mjs CONTEXTS table; a rendering-vocabulary brief (shader, wgsl, sky, clouds, rg-graphics...) drops loose sizing words (px, pixels, gap, anchor, scale, resolution) and layout; UI-only words (font size, padding, margin, safe area, val::px, ppu) still block. Test hooks/dispatch-ui.test.mjs 19 passed (sky/clouds negative case, HUD+shader and plain HUD positive controls).
- [2026-11-11 06:30] (status) todo → review
