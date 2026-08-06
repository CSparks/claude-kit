---
id: KIT-T191
title: game-asset-artist is pinned to model: fable — an implementation agent on the most expensive tier, against the dispatch ladder
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:24:18Z
updated: 2026-08-06T02:27:51Z
---

## Description
`agents/game-asset-artist.md` carried `model: fable` while every other kit work agent pins `opus`.
The dispatch ladder puts implementation on opus and reserves fable for orchestration and the hardest
reasoning (KIT-D043, KIT-T151), so an asset-authoring agent on fable is the most expensive tier
doing everyday work: a stiletto dispatch on 2026-08-04 ran ~230K tokens at fable pricing and its
commits were signed "Claude Fable 5" though the dispatch intended opus.

CONTRADICTS ITS CAPTURE: inbox 2026-08-04-2110 diagnosed a MISSING pin ("apparently never got the
pin, so it inherits the main-thread model"). The pin was present — it named fable. The symptom is
identical either way (a fable-signed commit from an opus-intended dispatch), which is why an
explicit pin was not suspected. The capture's other ask — sweep every kit agent for missing pins —
was done: all seven pin a model, and none other named fable.

The pins are part of the dispatch-guard contract (the gate ALLOWS a model-less delegation to a kit
agent precisely because its frontmatter pins a model), so they are now asserted by a sweep in that
gate's test instead of trusted.

Provenance: inbox 2026-08-04-2110.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] game-asset-artist pins model: opus
- [x] every agents/*.md carries a model pin and none pins fable, asserted by a test sweep
- [x] the capture's missing-pin diagnosis is corrected in the record (the pin existed and named fable)

## Plan
1. Pin game-asset-artist to opus.
2. Sweep every agents/*.md and assert the pins in hooks/dispatch-guard.test.mjs.

## History
- [2026-08-06 02:24] (created) bug — game-asset-artist is pinned to model: fable — an implementation agent on the most expensive tier, against the dispatch ladder
- [2026-08-06 02:27] (comment) criterion added: game-asset-artist pins model: opus
- [2026-08-06 02:27] (comment) criterion added: every agents/*.md carries a model pin and none pins fable, asserted by a test sweep
- [2026-08-06 02:27] (comment) criterion added: the capture's missing-pin diagnosis is corrected in the record (the pin existed and named fable)
- [2026-08-06 02:27] (comment) ticked: game-asset-artist pins model: opus
- [2026-08-06 02:27] (comment) ticked: every agents/*.md carries a model pin and none pins fable, asserted by a test sweep
- [2026-08-06 02:27] (comment) ticked: the capture's missing-pin diagnosis is corrected in the record (the pin existed and named fable)
- [2026-08-06 02:27] (status) todo → review
- [2026-08-06 02:27] (comment) fixed: pinned to opus + a pin sweep in the dispatch gate's test. Evidence: hooks/dispatch-guard.test.mjs all PASS incl. 14 new pin assertions.
