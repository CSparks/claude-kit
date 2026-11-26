---
id: KIT-T1599
title: pre-write dead-code check false positive: a doc-comment continuation line whose first word is 'removed' ('//   removed, or null when no segm
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:28:35Z
updated: 2026-11-26T06:00:45Z
---

## Description
pre-write dead-code check false positive: a doc-comment continuation line whose first word is 'removed' ('//   removed, or null when no segment of the command redirects into `file`', describing a return value in hooks/lib/chain-producer.mjs) is refused as a dead-code trace comment; the same words mid-line passed. Root cause: the trace pattern keys on a line-leading past-tense verb without checking it continues a sentence from the line above.

kit-bug-shape: cap:bug:pre-write-dead-code-check-false-positive-a-doc-c:5f49d905
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: the check moved to hooks/lib/dead-code-trace.mjs (isDeadCodeTrace(lines, i)); pre-write's pick takes a (lines, i) predicate. A lowercase 'removed' with no colon, continuing an unfinished comment sentence with the same marker on the line above, passes. Limit: an Edit whose new text starts at the continuation line has no line above in the payload and still blocks. Tests: new hooks/pre-write-dead-code.test.mjs 6 passed 1 failed without the pre-write change, 7 passed 0 failed with it; pre-write.test 75 passed.

## History
- [2026-11-26 01:28] (created) bug — pre-write dead-code check false positive: a doc-comment continuation line whose first word is 'removed' ('//   removed, or null when no segm
- [2026-11-26 06:00] (status) todo → review
