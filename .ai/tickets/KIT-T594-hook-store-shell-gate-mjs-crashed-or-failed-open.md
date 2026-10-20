---
id: KIT-T594
title: hook store-shell-gate.mjs crashed or failed open
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T23:38:06Z
updated: 2026-10-20T00:53:05Z
fixed_commit: b6dd07f
---

## Description
node:internal/modules/cjs/loader:1423 |   throw err; |   ^

kit-bug-shape: hook-error:store-shell-gate.mjs
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 23:38] (created) bug — hook store-shell-gate.mjs crashed or failed open
- [2026-10-19 23:38] (comment) seen again in dirt-empire: node:internal/modules/cjs/loader:1423 | throw err; | ^
- [2026-10-20 00:04] (comment) seen again in claude-kit: node:internal/modules/cjs/loader:1423 | throw err; | ^
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) compat-core no-ops a hook script the sealed runtime does not carry yet (wiring ahead of publish); test hooks/compat-launcher.test.mjs (9 passed)
