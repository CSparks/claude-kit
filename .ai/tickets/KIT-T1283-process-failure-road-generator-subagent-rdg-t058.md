---
id: KIT-T1283
title: process failure (road-generator subagent, RDG-T058 asphalt job): ran sleep 45 to wait on a background probe capture and hit the broker-wait
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T21:33:12Z
updated: 2026-11-15T21:47:30Z
---

## Description
process failure (road-generator subagent, RDG-T058 asphalt job): ran sleep 45 to wait on a background probe capture and hit the broker-wait gate (KIT-D115). Root cause: no sanctioned wait for a private probe run that takes 6 minutes; the only wait is the exit notification, which a subagent cannot idle on. Prevention wanted: the dispatch brief or gate text for a private-probe capture says to start it in the background and do other work until the notification, and the broker offers a one-call wait for non-broker processes.

kit-bug-shape: cap:bug:process-failure-road-generator-subagent-rdg-t058:9b81e4f3
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built in 0802bb0 (runtime 0802bb0, plugin 0.1.54). Hook model: a subagent shell and its children end with it, the no-wait gate refuses sleeps, polls and background waits, one foreground call ends at about 180 s, and the broker daemon takes only broker jobs (the measure lane runs in a check-tree copy, not the shared checkout where a private probe needs its built exe). So the verb is a launcher plus a detached worker: builds --run with a command, optional out file, cwd, limit and the --timeout and --tool-timeout window of builds --wait. It writes a record under target/broker/runs, spawns the worker detached (the launcher parent exits, so a process-tree kill of the agent shells finds no child), waits ONCE in the same call and returns the command exit, or exit 2 with the run id, the output file, the finished.log line to expect and builds --result with the id. The worker runs the command through bash -c with bin/build-shims first on PATH (a cargo call inside takes cores from the budget), stops it at its limit (default 1200 s, recorded as timeout) and appends the id, exit<N> or timeout, agent and ticket to target/broker/finished.log (the orchestrator Monitor line, finished-log.mjs). builds --result reads the record once. The broker-wait-gate and wait-poll refusals, the 15 agent definitions and docs/wait-rule.md now name the verb. Tests: scripts/broker/detached-run.test.mjs 6 passed (exit, output and finished line; still running after the window and finishing with no launcher; limit stops and records timeout; out file; CLI exit codes 0, 2, 64; the sleep refusal names the verb and the verb itself is not refused), mutation-checked (the limit kill). Related suites pass: broker-wait-gate 88, wait-poll 32, agent-timeout-rule 115, contract-rules 48, plugin-drift 14, plugin-compat 159, build-status 3. Not verified: that the real harness leaves the detached worker alive after SubagentStop (only the process-tree argument and the unit tests); the first road-generator probe run will show it. The new agent text needs /plugin update (0.1.54) and a reload in running sessions; the hook refusal texts apply at once.

## History
- [2026-11-15 21:33] (created) bug — process failure (road-generator subagent, RDG-T058 asphalt job): ran sleep 45 to wait on a background probe capture and hit the broker-wait
- [2026-11-15 21:46] (landed) 0802bb0 builds --run starts a long command once in a process that outlives the agent's turn, waits once in the same call and nam
- [2026-11-15 21:47] (status) todo → review
