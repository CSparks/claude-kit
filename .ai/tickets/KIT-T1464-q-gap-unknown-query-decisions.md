---
id: KIT-T1464
title: q gap: unknown query 'decisions'
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-21T13:44:28Z
updated: 2026-11-21T14:26:42Z
---

## Description
q decisions

kit-bug-shape: q-gap:verb:decisions
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] orient no longer points at the missing q decisions verb (orient.test.mjs asserts it)

## Plan
1.

## Notes
Fixed by removing the pointer, not adding a verb: orient pointed at 'q decisions', which does not exist. hooks/lib/orient/decisions.mjs now points at 'q recent 30d' (+N more) and 'q fts <area>' (out-of-scope standing decisions); hooks/orient.test.mjs asserts the pointer names an existing command and that 'q decisions' no longer appears. No other file names the verb.

## History
- [2026-11-21 13:44] (created) bug — q gap: unknown query 'decisions'
- [2026-11-21 13:44] (comment) seen again in claude-kit: q decisions
- [2026-11-21 14:26] (comment) criterion added: orient no longer points at the missing q decisions verb (orient.test.mjs asserts it)
- [2026-11-21 14:26] (comment) ticked: orient no longer points at the missing q decisions verb (orient.test.mjs asserts it)
- [2026-11-21 14:26] (status) todo → review
