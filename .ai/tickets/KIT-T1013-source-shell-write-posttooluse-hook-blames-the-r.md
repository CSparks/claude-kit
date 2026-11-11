---
id: KIT-T1013
title: source-shell-write PostToolUse hook blames the running Bash call for files other parallel agents edited in the shared checkout (reports Play
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:27:12Z
updated: 2026-11-11T04:27:12Z
---

## Description
source-shell-write PostToolUse hook blames the running Bash call for files other parallel agents edited in the shared checkout (reports PlaybackClockTest.kt, SortLabels.kt, emu-shot.mjs etc. after read-only gradle/q/adb commands) and also blocks a read-only node -e parse of a test-results XML as a 'hand write'; it should diff only paths the call itself could have touched

kit-bug-shape: cap:bug:source-shell-write-posttooluse-hook-blames-the-r
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:27] (created) bug — source-shell-write PostToolUse hook blames the running Bash call for files other parallel agents edited in the shared checkout (reports Play
