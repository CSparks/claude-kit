---
id: KIT-T1605
title: q gap: 'code' has no --color-text flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T07:14:53Z
updated: 2026-11-26T07:22:58Z
---

## Description
q code --color-text --path src/styles

kit-bug-shape: q-gap:flag:code:--color-text
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in scripts/code-index-query.mjs parseCodeArgs: when no other search text is given and exactly one flag-shaped token is unknown, that token is the search text (a CSS variable such as --color-text). 'q code -- <text>' already worked. Tests: scripts/code-index.test.mjs 30 passed 1 failed before, 31 passed 0 failed after; controls: beside other text, and two unknown flags with no text, stay reported. q-server 8/0.

## History
- [2026-11-26 07:14] (created) bug — q gap: 'code' has no --color-text flag
- [2026-11-26 07:22] (status) todo → review
