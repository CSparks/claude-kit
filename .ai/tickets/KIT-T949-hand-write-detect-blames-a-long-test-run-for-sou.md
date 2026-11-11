---
id: KIT-T949
title: hand-write-detect blames a long test run for source files a concurrent kit agent session edited during it (session-overlap.mjs, session-over
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:44:48Z
updated: 2026-11-10T19:18:34Z
---

## Description
hand-write-detect blames a long test run for source files a concurrent kit agent session edited during it (session-overlap.mjs, session-overlap.test.mjs, turn-writes.mjs flagged on a node hooks/hand-write-detect.test.mjs call that never touched them; claude-kit 2026-11-10)

kit-bug-shape: cap:bug:hand-write-detect-blames-a-long-test-run-for-sou
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 17:44] (created) bug — hand-write-detect blames a long test run for source files a concurrent kit agent session edited during it (session-overlap.mjs, session-over
- [2026-11-10 18:42] (landed) 371c2f1 shell attribution: a file an Edit or Write of another session left during a shell call is never credited to or blamed on
- [2026-11-10 18:57] (landed) 3018084 tool-writes: a prediction is unconfirmed (no timing slack, only PostToolUse-confirmed entries get it) and names its writ
- [2026-11-10 18:58] (comment) @claude: Root cause: the KIT-T888 exemption rests on the PostToolUse recorder (tool-write-record.mjs), which is registered in hoo (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:58] @claude
Root cause: the KIT-T888 exemption rests on the PostToolUse recorder (tool-write-record.mjs), which is registered in hooks.json; a session reads hooks.json at start, so sessions started before T888 (the kit's long-lived writers) never run it and the ledger for the kit tree stayed empty (no D--dev-claude-kit.toolwrites.json in the turn-state dir while two other trees had one). Fix: pre-write, which every session runs, records the hash of the content each Edit/Write leaves, only on exit 0, unconfirmed (no slack), writer-tagged (never excuses the writer's own call); confirmed Post entries keep a 5 s slack. hooks/hand-write-detect.test.mjs 69 passed, mutation-checked.
- [2026-11-10 19:04] (landed) 85f02ec pre-write records the content an Edit/Write leaves only when it exits 0, tagged with its writer; hand-write-detect exclu
- [2026-11-10 19:18] (status) todo → review
