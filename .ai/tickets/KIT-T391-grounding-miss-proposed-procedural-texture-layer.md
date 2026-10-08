---
id: KIT-T391
title: Grounding miss: proposed procedural texture layer styles (bevel/drop shadow/glow) as absent while rg_ui::paint::theme Decor (ST-T265) alread
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-08T00:08:20Z
updated: 2026-10-08T00:16:02Z
---

## Description
Grounding miss: proposed procedural texture layer styles (bevel/drop shadow/glow) as absent while rg_ui::paint::theme Decor (ST-T265) already holds that vocabulary. q fts 'procedural texture layer bevel' did not surface ST-T265 (title says 'Photoshop-style layer decoration', no 'texture'); synonym gap between 'layer style'/'bevel' and 'decoration'. Want: q fts expands concept synonyms or a code-side q sym hit (Bevel struct) shown alongside fts.

kit-bug-shape: cap:bug:grounding-miss-proposed-procedural-texture-layer
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q fts appends an 'also in code' section of up to 5 code definitions named by the query terms (test: scripts/code-index.test.mjs ftsCodeDefs + CLI)

## Plan
1.

## History
- [2026-10-08 00:08] (created) bug — Grounding miss: proposed procedural texture layer styles (bevel/drop shadow/glow) as absent while rg_ui::paint::theme Decor (ST-T265) alread
- [2026-10-08 00:16] (comment) criterion added: q fts appends an 'also in code' section of up to 5 code definitions named by the query terms (test: scripts/code-index.test.mjs ftsCodeDefs + CLI)
- [2026-10-08 00:16] (comment) ticked: q fts appends an 'also in code' section of up to 5 code definitions named by the query terms (test: scripts/code-index.test.mjs ftsCodeDefs + CLI)
- [2026-10-08 00:16] (status) todo → review
