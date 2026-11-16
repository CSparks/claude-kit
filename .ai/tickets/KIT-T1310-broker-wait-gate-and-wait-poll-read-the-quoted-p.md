---
id: KIT-T1310
title: broker-wait-gate (and wait-poll) read the quoted prose of a data command as a broker poll when the line also holds a non-data segment: a for
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T10:02:26Z
updated: 2026-11-16T10:06:59Z
---

## Description
broker-wait-gate (and wait-poll) read the quoted prose of a data command as a broker poll when the line also holds a non-data segment: a for-loop of t notes with prose naming 'tail -F ... | grep --line-buffered' was blocked as a tail loop around the broker (withoutDataArguments empties quotes only when EVERY segment is a data command)

kit-bug-shape: cap:bug:broker-wait-gate-and-wait-poll-read-the-quoted-p:732f27b3
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root: withoutDataArguments (broker-wait-gate, wait-poll) emptied quoted arguments only when EVERY segment of the line was a data command, so one for-loop header or non-data segment left the prose of a t notes live. Both gates now use withoutDataSegmentArguments (per segment; a leading do/then/if/while/until/{ is skipped when judging the segment). Tests: hooks/broker-wait-gate.test.mjs 90 (2 new, KIT-T1310; the prose case fails on the old code), wait-poll 36, source-shell-gate-data-prose 6, git-gaps, discard, delete, chained, escapes, commit-gate-git-call exit 0.

## History
- [2026-11-16 10:02] (created) bug — broker-wait-gate (and wait-poll) read the quoted prose of a data command as a broker poll when the line also holds a non-data segment: a for
- [2026-11-16 10:06] (status) todo → review
