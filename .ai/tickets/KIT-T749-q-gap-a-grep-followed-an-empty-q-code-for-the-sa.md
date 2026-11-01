---
id: KIT-T749
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T01:19:25Z
updated: 2026-11-01T23:23:20Z
---

## Description
q: q code "JUCE_DIRECT2D|JUCE_USE_DIRECT2D|juce_opengl|JUCE_OPENGL" --kind config --limit 20 2>&1  then  grep: JUCE_DIRECT2D\|DIRECT2D

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: JUCE lives at C:/JUCE (outside the repo; groovegrid's CMake adds it by path), so the index holds no JUCE_DIRECT2D line and the empty answer gave no way forward; the agent grepped. Fix: an empty q code now ends with 'NOT searched: gitignored build directories and trees outside the repo are not indexed; search one with --dir <path> or an absolute --path <dir> ... never grep' (suppressed when --dir or an absolute path was given); q-miss reads that line as an empty answer so the grep-after-empty-q monitor still files. Tests: code-index 27 passed, kit-bug test (q-miss case), search-telemetry 22 passed.

## History
- [2026-10-31 01:19] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-11-01 23:23] (status) todo → doing
- [2026-11-01 23:23] (status) doing → review
- [2026-11-01 23:23] (landed) bee2e66 q code: a lone -- makes the next token search text; an empty q code says gitignored and out-of-repo trees are searched w
