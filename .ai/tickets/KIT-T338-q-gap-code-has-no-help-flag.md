---
id: KIT-T338
title: q gap: 'code' has no --help flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T01:44:11Z
updated: 2026-10-27T21:26:36Z
---

## Description
q code --help

kit-bug-shape: q-gap:flag:code:--help
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code|sym|file --help prints the verb usage, exit 0, no gap ticket

## Plan
1.

## Notes
2026-10-27 q <verb> --help now prints that verb's entry from the query surface (new scripts/q-help.mjs: QUERY_SURFACE moved out of q-lib.mjs + verbHelp); the resident-server client skips --help so the in-process path answers; unknown verb --help prints the whole surface. Tests: scripts/kit-bug.test.mjs 18 passed (verb help for code/sym/file/open, no ticket filed), q-gaps 10, q-server 8, code-index 24, q 112. A publish would ship the new q --help behaviour to all sessions.

## History
- [2026-10-06 01:44] (created) bug — q gap: 'code' has no --help flag
- [2026-10-09 21:31] (comment) seen again in claude-kit: q code --help
- [2026-10-27 21:26] (comment) criterion added: q code|sym|file --help prints the verb usage, exit 0, no gap ticket
- [2026-10-27 21:26] (comment) ticked: q code|sym|file --help prints the verb usage, exit 0, no gap ticket
- [2026-10-27 21:26] (status) todo → review
