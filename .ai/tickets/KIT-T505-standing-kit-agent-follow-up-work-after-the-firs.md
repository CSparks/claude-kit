---
id: KIT-T505
title: standing kit agent: follow-up work after the first SubagentHandback has no delivery path (second handback refused 'already delivered'; final text not delivered); coordinator must be told to use SendMessage or a fresh dispatch
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T13:47:59Z
updated: 2026-10-15T15:04:49Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T425
### comment #2 [2026-10-15 22:20] @claude
Recurred 2026-10-15 (dirt-empire): patch-worker a856c13 completed after 86 tool calls / 110 min; the task notification said its report was delivered via SubagentHandback, but no agent-message reached the orchestrator. Work reconciled from git (2015e69, 3b25c3f, 8866d75) and broker results.

## History
- [2026-10-15 13:47] (created) bug — standing kit agent: follow-up work after the first SubagentHandback has no delivery path (second handback refused 'already delivered'; final text not delivered); coordinator must be told to use SendMessage or a fresh dispatch
- [2026-10-15 15:04] (comment) @claude: fixed in this commit: tests broker suite 241+ passed (npm test exit 0); testkit-leak.test.mjs / hydrate-sources.test.mjs / metrics.test.mjs / suite-starve.test.mjs / stop.test.mjs added with controls
- [2026-10-15 15:04] (status) todo → review
- [2026-10-15 22:20] (comment) @claude: Recurred 2026-10-15 (dirt-empire): patch-worker a856c13 completed after 86 tool calls / 110 min; the task notification s (full comment #2 in ## Notes)
