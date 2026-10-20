---
id: KIT-T332
title: Process failure (dirt-empire 2026-10-05): imported the WRONG trophy truck into Blender — the game's shared/trophy.rhai model instead of the
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-05T15:47:59Z
updated: 2026-10-20T00:52:12Z
fixed_commit: 0d87eed
---

## Description
Process failure (dirt-empire 2026-10-05): imported the WRONG trophy truck into Blender — the game's shared/trophy.rhai model instead of the alternate integrated shell Chris had been working on (another session's scratchpad alt/integrated). Root cause: the in-flight workstream lived only in ~12 untriaged .ai/inbox notes and a Temp scratchpad of session cf28729b; SESSION.md (the resume anchor) described only the older asset-correction pass, orient did not surface untriaged same-day inbox notes naming an active model, and I picked the model from SESSION.md + the code without reading the inbox. Two live models of one asset = KIT-T227 stop-and-ask, which never fired because nothing listed the twin. Fix direction: orient surfaces untriaged inbox notes newer than SESSION.md as ACTIVE WORK; scratch-only work products get flagged at flush.

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-05-imported-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-05 15:47] (created) bug — Process failure (dirt-empire 2026-10-05): imported the WRONG trophy truck into Blender — the game's shared/trophy.rhai model instead of the
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) housekeeping lists untriaged captures newer than SESSION.md as ACTIVE WORK; test hooks/active-inbox.test.mjs (6 passed) and hooks/housekeeping.test.mjs (40 passed). orient.mjs is over the 600-line gate, so the line lives in housekeeping (a split of orient.mjs is a presented restructure, not done)
