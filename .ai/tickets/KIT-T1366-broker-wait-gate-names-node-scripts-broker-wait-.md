---
id: KIT-T1366
title: broker-wait gate names 'node scripts/broker/wait.mjs <id> --root <tree> --timeout 170' as the one sanctioned wait, but for a run id from bui
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T02:20:55Z
updated: 2026-11-18T02:56:33Z
fixed_commit: 7d036958
---

## Description
broker-wait gate names 'node scripts/broker/wait.mjs <id> --root <tree> --timeout 170' as the one sanctioned wait, but for a run id from builds --run (run-20261118021739-gs0t) wait.mjs answers 'unknown job ... not queued, running or resulted' (exit 3): a subagent has no working single wait for a builds --run that outlasts its first 170 s. Seen in road-generator 2026-11-18. Want: wait.mjs (or builds --wait-run <id>) waits on a run id, or the gate text names the command that does.

Checked as possible duplicates and judged different work (--not-dup): KIT-T1365

kit-bug-shape: cap:bug:broker-wait-gate-names-node-scripts-broker-wait-:dafb4f27
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] wait.mjs given a builds --run id reads the run record once (never polls): exit 2 with how to resume while it runs, 0 or 1 by its exit once ended; an id that names nothing is still unknown (exit 3) (scripts/broker/detached-run.test.mjs)
- [x] the broker-wait block names wait.mjs for broker jobs only and the one builds --run call for long commands; docs/BROKER.md's Monitor paragraph (KIT-T1349) says the same

## Plan
1.

## Notes
Chose: wait.mjs reads a run id's record once instead of waiting on it, so a second wait after builds --run (which already waited once, KIT-T1283) is still not offered; exit 2 while running with the resume line, 0/1 by the run's exit, unknown ids still exit 3. The broker-wait block now lists by kind: long command -> ONE builds --run call then end the turn; broker job -> wait.mjs once; build hold -> builds --wait. docs/BROKER.md Monitor paragraph agrees. Tests: detached-run 8 pass (new run-id case and the chained builds --run + tail -F refusal text); broker-wait-gate 90; wait, wait-exit, wait-guard pass.

## History
- [2026-11-18 02:20] (created) bug — broker-wait gate names 'node scripts/broker/wait.mjs <id> --root <tree> --timeout 170' as the one sanctioned wait, but for a run id from bui
- [2026-11-18 02:54] (status) todo → doing
- [2026-11-18 02:54] (comment) criterion added: wait.mjs given a builds --run id reads the run record once (never polls): exit 2 with how to resume while it runs, 0 or 1 by its exit once ended; an id that names nothing is still unknown (exit 3) (scripts/broker/detached-run.test.mjs)
- [2026-11-18 02:54] (comment) criterion added: the broker-wait block names wait.mjs for broker jobs only and the one builds --run call for long commands; docs/BROKER.md's Monitor paragraph (KIT-T1349) says the same
- [2026-11-18 02:54] (comment) ticked: wait.mjs given a builds --run id reads the run record once (never polls): exit 2 with how to resume while it runs, 0 or 1 by its exit once ended; an id that names nothing is still unknown (exit 3) (scripts/broker/detached-run.test.mjs)
- [2026-11-18 02:54] (comment) ticked: the broker-wait block names wait.mjs for broker jobs only and the one builds --run call for long commands; docs/BROKER.md's Monitor paragraph (KIT-T1349) says the same
- [2026-11-18 02:56] (landed) 7d036958 wait.mjs reads a builds --run id once instead of answering unknown job; the broker-wait block and the wait rule name ONE
- [2026-11-18 02:56] (status) doing → review
- [2026-11-18 02:56] (comment) runtime 7d036958 published, plugin 0.1.57
