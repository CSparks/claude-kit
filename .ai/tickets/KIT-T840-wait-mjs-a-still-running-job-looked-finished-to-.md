---
id: KIT-T840
title: wait.mjs: a still-running job looked finished to callers (patch-worker 2026-11-02: 'running 45s' then exit 0); the last stdout line now names the state and exit code (STILL RUNNING exit 2)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T19:59:37Z
updated: 2026-11-02T19:59:56Z
---

## Description
wait.mjs already exits 2 for a job still queued or running and 0 only for passed/landed (scripts/broker/wait.test.mjs, wait-exit.test.mjs), so the exit-0 reading came from a wrapper (pipe through tail/grep, harness auto-background task notification reporting the wrapper's status 0). Fix: wait.mjs prints 'wait: <id> <state> (exit N)' as its last stdout line in every state, so a masked exit code still shows STILL RUNNING.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T308, KIT-T355
Diagnosis: wait.mjs exit codes were already right (0 passed/landed, 1 other final, 2 timeout/still running, 3 unknown). Exit 0 with 'running 45s' came from a wrapper (a pipe to tail/grep, or the harness task notification for a backgrounded wrapper reporting the wrapper's status). Fix: every wait.mjs exit path prints 'wait: <id> <state> (exit N)' last on stdout. Tests: wait-exit.test.mjs 9 passed (passed, landed 0; failed, gate, stale, conflict, dirty 1; queued job STILL RUNNING 2; unknown 3), wait.test.mjs 3 passed.

## History
- [2026-11-02 19:59] (created) bug — wait.mjs: a still-running job looked finished to callers (patch-worker 2026-11-02: 'running 45s' then exit 0); the last stdout line now names the state and exit code (STILL RUNNING exit 2)
- [2026-11-02 19:59] (status) todo → review
- [2026-11-02 20:00] (landed) e769a0a wait.mjs prints its state and exit code as the last stdout line in every case (STILL RUNNING exit 2); wait-exit 9, wait 
