---
id: KIT-T1343
title: pre-write comment-narration gate misfires on a doc path with a date inside a // or //! comment: a Rust test header naming docs/perf/mountain
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T15:13:50Z
updated: 2026-11-17T15:16:26Z
---

## Description
pre-write comment-narration gate misfires on a doc path with a date inside a // or //! comment: a Rust test header naming docs/perf/mountain-shape-2026-11-17.md was read as a dated stamp (history narration), blocking the write; the date is part of a file name, not history. The gate should ignore dates inside path-like tokens (a / or . adjacent, ending in a file extension) while still blocking 'on 2026-11-17 we changed' stamps

kit-bug-shape: cap:bug:pre-write-comment-narration-gate-misfires-on-a-d:a953e888
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x]
- [x] A date inside a path, file name, code span or link target in a comment passes comment-narration; a dated stamp (on D we changed, D: fixed, (D)) still blocks

## Plan
1.

## Notes
hooks/lib/comment-scan.mjs hasDatedStamp: a date is a name when preceded by / \ _ . or alnum-, followed by / \ _ .ext or -alnum, or inside a backtick span or markdown link target. Tests: hooks/comment-gate.test.mjs (51 passed): 8 name cases pass, 5 stamp cases block, pre-write gate on a Rust //! doc comment.

## History
- [2026-11-17 15:13] (created) bug — pre-write comment-narration gate misfires on a doc path with a date inside a // or //! comment: a Rust test header naming docs/perf/mountain
- [2026-11-17 15:16] (comment) ticked:
- [2026-11-17 15:16] (comment) criterion added: A date inside a path, file name, code span or link target in a comment passes comment-narration; a dated stamp (on D we changed, D: fixed, (D)) still blocks
- [2026-11-17 15:16] (comment) ticked: A date inside a path, file name, code span or link target in a comment passes comment-narration; a dated stamp (on D we changed, D: fixed, (D)) still blocks
- [2026-11-17 15:16] (status) todo → review
