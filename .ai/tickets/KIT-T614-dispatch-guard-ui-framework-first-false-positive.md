---
id: KIT-T614
title: dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T16:09:33Z
updated: 2026-11-01T21:57:28Z
---

## Description
dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI work) because the brief mentioned that another worker was landing 'rg-screens volume rows' in the same lane. A passing mention of a UI crate is not UI work; the check should key on the brief's own task, not on any UI noun. Hit 2026-10-21 in stiletto-2349.

kit-bug-shape: cap:bug:dispatch-guard-ui-framework-first-false-positive
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Second hit 2026-11-01 (Plan brief on procedural level/room generation). Fix: hooks/dispatch-ui.mjs drops layout as a sizing word when the brief carries level/world generation vocabulary. Test: hooks/dispatch-ui.test.mjs 11 passed with the level-generation brief as negative case. The 2026-10-21 variant (passing mention of rg-screens volume rows) is not addressed.

## History
- [2026-10-21 16:09] (created) bug — dispatch-guard ui-framework-first false positive: blocked a vehicle-physics patch-worker brief (rg-physics/rg-vehicle twin extraction, no UI
- [2026-11-01 21:54] (comment) seen again in claude-kit: dispatch-guard ui-framework-first false-positive: a read-only Plan brief about procedural level and room generation (room layouts, layout, dungeon) was blocked as UI layout work; UI detection must not trigger on world or level layout vocabulary
- [2026-11-01 21:54] (asked again) 2026-11-01 — cap:bug:dispatch-guard-ui-framework-first-false-positive
- [2026-11-01 21:57] (status) todo → review
- [2026-11-01 21:57] (landed) 4783974 fix: decisions and requests count as request captures; level-generation briefs are not UI work (implements KIT-T808, KIT
