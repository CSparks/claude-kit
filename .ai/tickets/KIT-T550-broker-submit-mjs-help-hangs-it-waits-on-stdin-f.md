---
id: KIT-T550
title: broker submit.mjs --help hangs: it waits on stdin for an envelope instead of printing usage (a patch-worker lost 120 s, ST-T904 round 12). P
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T20:07:26Z
updated: 2026-10-16T21:32:17Z
fixed_commit: 46391c2
---

## Description
broker submit.mjs --help hangs: it waits on stdin for an envelope instead of printing usage (a patch-worker lost 120 s, ST-T904 round 12). Print usage on --help / -h and when stdin is a TTY with no envelope.

kit-bug-shape: cap:bug:broker-submit-mjs-help-hangs-it-waits-on-stdin-f
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 20:07] (created) bug — broker submit.mjs --help hangs: it waits on stdin for an envelope instead of printing usage (a patch-worker lost 120 s, ST-T904 round 12). P
- [2026-10-16 21:32] (comment) @claude: fixed 46391c2: submit.mjs prints usage (exit 0) for --help and -h before reading stdin, and usage with exit 2 when stdin (full comment #1 in ## Notes)
### comment #1 [2026-10-16 21:32] @claude
fixed 46391c2: submit.mjs prints usage (exit 0) for --help and -h before reading stdin, and usage with exit 2 when stdin is a terminal and no --no-patch. Evidence: scripts/broker/submit-usage.test.mjs 3 passed; the help case hung 20 s (stdin held open) before; controls: a piped envelope still queues, --no-patch needs none. broker glob 336 passed.
- [2026-10-16 21:32] (status) todo → review
- [2026-10-16 21:32] (comment) submit-usage.test.mjs 3 passed
