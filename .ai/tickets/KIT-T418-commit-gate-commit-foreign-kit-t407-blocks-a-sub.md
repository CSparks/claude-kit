---
id: KIT-T418
title: commit-gate commit-foreign (KIT-T407) blocks a submodule pin whose submodule commit this session made: stiletto 'git add rapid-game' after c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T15:23:43Z
updated: 2026-10-10T15:33:54Z
---

## Description
commit-gate commit-foreign (KIT-T407) blocks a submodule pin whose submodule commit this session made: stiletto 'git add rapid-game' after committing rapid-game 5403ecf was flagged foreign because the gate tracks Write/Edit paths only, not commits made inside a submodule

kit-bug-shape: cap:bug:commit-gate-commit-foreign-kit-t407-blocks-a-sub
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 15:23] (created) bug — commit-gate commit-foreign (KIT-T407) blocks a submodule pin whose submodule commit this session made: stiletto 'git add rapid-game' after c
- [2026-10-10 15:33] (comment) @claude: fixed 5d6974f; test: commit-gate 38 passed (hooks/commit-gate.test.mjs, 4 T418 cases)
- [2026-10-10 15:33] (status) todo → review
