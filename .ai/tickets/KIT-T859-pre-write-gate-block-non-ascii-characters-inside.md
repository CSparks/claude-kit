---
id: KIT-T859
title: pre-write gate: block non-ASCII characters inside narrow C++ string literals not wrapped in a UTF-8 helper
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T16:45:05Z
updated: 2026-11-05T16:45:05Z
---

## Description
juce::String(const char*) reads UTF-8 bytes as Latin-1, so a literal like Export Track + ellipsis renders mojibake in menus and dialogs (groovegrid GG-T167: 59 literals; Chris 2026-11-04: HOW DO WE STOP HAVING THESE). Add a check for C/C++ files in JUCE projects: a quoted literal with a char above 0x7F fails unless the literal sits inside u8( / CharPointer_UTF8( / fromUTF8( / L-prefixed, or on a log line. Project config names the helper.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-05 16:45] (created) feature — pre-write gate: block non-ASCII characters inside narrow C++ string literals not wrapped in a UTF-8 helper
