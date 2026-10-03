---
id: KIT-T309
title: cap-filed kit tickets truncate the Description to 300 chars with whitespace collapsed (kit-bug.mjs EXAMPLE_MAX), losing KIT-T304 and KIT-T30
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T16:43:53Z
updated: 2026-10-03T16:44:18Z
---

## Description
cap-filed kit tickets truncate the Description to 300 chars with whitespace collapsed (kit-bug.mjs EXAMPLE_MAX), losing KIT-T304 and KIT-T307 text

kit-bug-shape: cap:bug:cap-filed-kit-tickets-truncate-the-description-t
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a long capture lands in the ticket Description whole

## Plan
1.

## History
- [2026-10-03 16:43] (created) bug — cap-filed kit tickets truncate the Description to 300 chars with whitespace collapsed (kit-bug.mjs EXAMPLE_MAX), losing KIT-T304 and KIT-T30
- [2026-10-03 16:43] (comment) seen again in claude-kit: cap-filed kit tickets truncate the Description to 300 chars with whitespace collapsed (kit-bug.mjs EXAMPLE_MAX), losing KIT-T304 and KIT-T307 text
- [2026-10-03 16:44] (comment) criterion added: a long capture lands in the ticket Description whole
- [2026-10-03 16:44] (comment) ticked: a long capture lands in the ticket Description whole
- [2026-10-03 16:44] (comment) @sonnet55: cause: fileKitBug built the Description from a whitespace-collapsed 300-char example (EXAMPLE_MAX). Now the full trimmed (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:44] @sonnet55
cause: fileKitBug built the Description from a whitespace-collapsed 300-char example (EXAMPLE_MAX). Now the full trimmed capture; the one-line seen-again comment keeps the short form. KIT-T307 description restored by hand; KIT-T304 original text is not recoverable (only its 300-char prefix survives). Tests: scripts/kit-bug.test.mjs 15 passed; mutation (description back to example) fails the long-capture test.
- [2026-10-03 16:44] (status) todo → review
