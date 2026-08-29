---
id: KIT-T267
title: dispatch-guard misses a pinned agent when the hook's cwd sits inside a submodule — pinnedModel probes only that repo's .claude/agents, never the superproject's, so a pinned opus48 dispatch from stiletto's rapid-game submodule is blocked as a fable inherit
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-29T21:51:25Z
updated: 2026-08-29T21:53:07Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-08-29 21:51] (created) bug — dispatch-guard misses a pinned agent when the hook's cwd sits inside a submodule — pinnedModel probes only that repo's .claude/agents, never the superproject's, so a pinned opus48 dispatch from stiletto's rapid-game submodule is blocked as a fable inherit
- [2026-08-29 21:53] (comment) @claude: Fix: pinnedModel probes the project root and every superproject above it (git rev-parse --show-superproject-working-tree (full comment #1 in ## Notes)
### comment #1 [2026-08-29 21:53] @claude
Fix: pinnedModel probes the project root and every superproject above it (git rev-parse --show-superproject-working-tree chain). Tests: hooks/model-tag.test.mjs section 2b (superproject pin visible from inside the submodule + an unrelated repo negative control) — model-tag 64 passed; dispatch-guard suite green.
- [2026-08-29 21:53] (status) todo → review
