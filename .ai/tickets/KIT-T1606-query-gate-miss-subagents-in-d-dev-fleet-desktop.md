---
id: KIT-T1606
title: query-gate miss: subagents in D:\dev\fleet-desktop read a source file with 'cat Cargo.toml | sed ...' and grepped a saved test log with shel
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T20:29:04Z
updated: 2026-11-26T20:32:08Z
---

## Description
query-gate miss: subagents in D:\dev\fleet-desktop read a source file with 'cat Cargo.toml | sed ...' and grepped a saved test log with shell grep/tail, and no hook blocked them (reported by two implementer agents this session). Root cause to find: the one-file-search / query-gate rules do not cover cat piped into sed on a named file, nor grep/tail on a file under src-tauri/target/.

kit-bug-shape: cap:bug:query-gate-miss-subagents-in-d-dev-fleet-desktop:fd267905
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Two causes, from the fleet-desktop subagent transcripts (agent-a100323833101e60a, agent-ad601e68d544a8540) replayed through query-gate. (1) cat src-tauri/Cargo.toml | sed -n '/dependencies/,$p' passed even in an adopted repo: fedSearch handled grep and Select-String only. Fixed: a sed or awk address search fed one named file is that file's search. Tests: query-gate-one-file 83 passed 2 failed before, 85 passed 0 failed after; query-gate-pipes all pass. (2) The tail and grep of src-tauri/target logs block in an adopted repo but fleet-desktop has no .ai store, and query-gate exits on an unadopted repo per the hook contract (hooks no-op unless the repo has .ai). Not changed: widening the gate to every git repo, or adopting fleet-desktop, is the maintainer's decision.

## History
- [2026-11-26 20:29] (created) bug — query-gate miss: subagents in D:\dev\fleet-desktop read a source file with 'cat Cargo.toml | sed ...' and grepped a saved test log with shel
- [2026-11-26 20:32] (status) todo → review
