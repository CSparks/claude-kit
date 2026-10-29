---
id: KIT-T670
title: Subagents leave hung 'python3 -' processes spinning a full core indefinitely on Windows: 2026-10-28 overnight fan-out left 5 (PIDs 54176 514
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T699
created: 2026-10-28T14:57:19Z
updated: 2026-10-28T14:57:19Z
---

## Description
Subagents leave hung 'python3 -' processes spinning a full core indefinitely on Windows: 2026-10-28 overnight fan-out left 5 (PIDs 54176 5140 69000 56292 63448, started 01:19-02:13, ~28k CPU-s each by 09:45) plus one from 2026-10-27 17:18 (PID 54828, 56k CPU-s). Each is 'C:/Users/Chris Sparks/bin/python3.exe -' (or C:/Python314/python.exe -) under a git-bash chain: an agent ran a python3 heredoc that never got EOF, the Bash tool auto-backgrounded it after 120s, and the agent finished without stopping it; one agent reported it 'couldn't stop' the background task. Root cause: no reaping of a subagent's background shell tasks when the agent completes, plus agents reaching for 'python3 -' heredocs on Windows. Fix direction: kill a subagent's background tasks on completion (or report them in the hand-back), and a pre-tool hook that refuses 'python3 -' / stdin-script invocations in favour of a written script file.

kit-bug-shape: cap:bug:subagents-leave-hung-python3-processes-spinning-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 14:57] (created) bug — Subagents leave hung 'python3 -' processes spinning a full core indefinitely on Windows: 2026-10-28 overnight fan-out left 5 (PIDs 54176 514
- [2026-10-29 15:48] (status) → superseded (by KIT-T699)
