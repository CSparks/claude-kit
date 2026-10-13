---
id: KIT-T294
title: Editor preview built over a generator the game does not run: ST-T758 Structures tool previews rg_landform::recipes::shaft, which no worldgen
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T19:31:34Z
updated: 2026-10-02T19:31:34Z
---

## Description
Editor preview built over a generator the game does not run: ST-T758 Structures tool previews rg_landform::recipes::shaft, which no worldgen path calls (game mines = recipes::mine, bunkers = marblequest grid + rooms), and shows it as a flat section cut instead of in its terrain. Violates ST-D139/ST-

kit-bug-shape: cap:bug:editor-preview-built-over-a-generator-the-game-d
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-02 19:31] (created) bug — Editor preview built over a generator the game does not run: ST-T758 Structures tool previews rg_landform::recipes::shaft, which no worldgen
- [2026-10-13 19:49] (comment) @sonnet55: Proposed fix (not built; for the maintainer): the failure is building an editor preview over a generator the game never  (full comment #1 in ## Notes)
### comment #1 [2026-10-13 19:49] @sonnet55
Proposed fix (not built; for the maintainer): the failure is building an editor preview over a generator the game never runs. Gate it at the brief: an editor-tool dispatch must first paste the game-side call site (file:line from 'q code <recipe fn>' excluding tools/ and tests/) that runs the generator; no call site, no build (ST-D139 parity). Kit work if accepted: (1) a gotcha line in agents/editor-workbench.md; (2) a code-graph query 'callers-of <symbol> --not-path tools,tests' so the check is one command; (3) optionally a rapid-game test per editor recipe asserting a non-editor caller exists. Decision needed: accept (1)+(2) as the minimum, or also (3).
