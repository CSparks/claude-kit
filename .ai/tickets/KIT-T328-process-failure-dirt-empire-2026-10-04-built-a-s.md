---
id: KIT-T328
title: Process failure (dirt-empire 2026-10-04): built a scratch silhouette scorer and proposed silhouette/lint/reference tooling as new, while rap
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T23:05:49Z
updated: 2026-10-04T23:05:49Z
---

## Description
Process failure (dirt-empire 2026-10-04): built a scratch silhouette scorer and proposed silhouette/lint/reference tooling as new, while rapid-game already carries rg-meshkit/src/silhouette.rs, meshcheck.rs, validate.rs, rg-meshkit-script bin meshkit-check + check/, bind/silhouette.rs, and rg-tool-asset-editor reference.rs + measure.rs. ROOT CAUSE: q returned (no results) for the framework submodule from the consumer repo (KIT-T327) and the empty result was treated as licence to propose instead of 'not checked' -> list the framework crate tree. Enforcement ask: when q code/sym/file returns empty and the repo has a framework submodule the index does not cover, q prints an explicit 'submodule NOT indexed - not checked' warning instead of a bare (no results).

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-04-built-a-s
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-04 23:05] (created) bug — Process failure (dirt-empire 2026-10-04): built a scratch silhouette scorer and proposed silhouette/lint/reference tooling as new, while rap
