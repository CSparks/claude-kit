---
id: KIT-T402
title: q gap: 'code' has no --project flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T20:45:52Z
updated: 2026-10-09T21:51:59Z
---

## Description
q code --project --path scripts --lang js -C 1

kit-bug-shape: q-gap:flag:code:--project
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 20:45] (created) bug — q gap: 'code' has no --project flag
- [2026-10-09 20:46] (comment) seen again in claude-kit: q code --project --path scripts/cap.mjs
- [2026-10-09 21:31] (comment) seen again in claude-kit: q code deck-deploy --project stiletto
- [2026-10-09 21:39] (status) todo → doing
- [2026-10-09 21:51] (status) doing → review

## Notes
Fix: q code/sym/file take --project <name|id key> (scripts/code-index-query.mjs, projectRepo in scripts/q-project.mjs; the resident server defers to the local path for it). From a stiletto cwd `q code readTarget --project claude-kit` finds scripts/deck-config.mjs. Evidence: scripts/code-index.test.mjs 21 passed (new --project case covers code, sym, file, unknown project, CLI); full chain 86 pass except pre-existing server/server.test.mjs (express missing). Code landed early in 596d1fc under KIT-T339.
