---
id: KIT-T494
title: orient.test 'device block stays tiny' reads the machine's live Deck alert (~/.claude/deck-deploy/alert.txt): fails whenever a real deck-deploy left a MAINTAINER ACTION; the test must isolate CLAUDE_KIT_DECK_HOME
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T21:30:41Z
updated: 2026-10-14T21:42:28Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): scripts/devices.mjs, hooks/live-sessions.test.mjs
### comment #1 [2026-10-14 21:42] @claude
Fixed: the device-block case sets CLAUDE_KIT_DECK_HOME to a temp dir, so a live alert.txt from a real deck-deploy no longer leaks into the block (it measured 472 chars with this machine's 21:09Z MAINTAINER ACTION). hooks/orient.test.mjs 28 passed.

## History
- [2026-10-14 21:30] (created) bug — orient.test 'device block stays tiny' reads the machine's live Deck alert (~/.claude/deck-deploy/alert.txt): fails whenever a real deck-deploy left a MAINTAINER ACTION; the test must isolate CLAUDE_KIT_DECK_HOME
- [2026-10-14 21:42] (comment) @claude: Fixed: the device-block case sets CLAUDE_KIT_DECK_HOME to a temp dir, so a live alert.txt from a real deck-deploy no lon (full comment #1 in ## Notes)
- [2026-10-14 21:42] (status) todo → review
