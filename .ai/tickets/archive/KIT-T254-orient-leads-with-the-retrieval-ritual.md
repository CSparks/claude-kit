---
id: KIT-T254
title: "orient leads with the RETRIEVAL FIRST ritual — q fts / q recent / ledger citation at the TOP, not line 347"
type: bug
status: done
priority: high
labels: [orient, retrieval, lapsed]
files:
  - hooks/orient.mjs
created: 2026-08-21T03:05:00Z
updated: 2026-10-27T22:27:24Z
---

## Description

Chris 2026-08-21: "Are the directions for using q being injected early and prominent
enough in KIT's initialization prompt?" Measured answer: no — in a 352-line orient the
only retrieval guidance sat at line 347 as a tool list ("QUERY don't grep: ..."), with
no WHEN (before proposing), no `q recent`, no ledger mention. The fastnoise
relitigation happened with that line in context: placement, not existence, was the
failure.

Fix: a RETRIEVAL FIRST block directly under the orientation header — q fts before
designing (relitigation = process failure), q recent for the window, the full-surface
pointer, the CHOICES.toml citation rule, and "empty query = NOT CHECKED".

## Acceptance Criteria
- [x] The block renders immediately after the header, before every content section.
- [x] Lock-in test: orient.test asserts presence AND top placement, so demotion fails
      the suite.

## History
- [2026-08-21 03:05] (created) bug — retrieval guidance buried at the bottom of orient
- [2026-08-21 03:10] (status) → review — orient 24 passed (2 new lock-in assertions)
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
