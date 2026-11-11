---
id: KIT-T851
title: wait.mjs misreports a running job: it printed running 57s applying, then its Bash call moved itself to the background and exited 1 with no v
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T03:56:53Z
updated: 2026-11-03T04:04:14Z
---

## Description
wait.mjs misreports a running job: it printed running 57s applying, then its Bash call moved itself to the background and exited 1 with no verdict while result-summary said no result yet (dirt-empire 2026-11-03, DE-T295 landing 3 worker ac2ef5ac2d231c068, job j-mw05haal-9zrq22). Exit 1 means a red result to every caller; a still-running job must exit 2 (KIT-T840), and a wait that is backgrounded by the tool must not report a failing code. Make wait.mjs end deterministically inside the tool limit with exit 2 plus the running line, and never leave a failing code for a pending job.

kit-bug-shape: cap:bug:wait-mjs-misreports-a-running-job-it-printed-run
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] wait.mjs ends inside its tool window with exit 2 and the running line; a stripped console, signal or loop throw on a pending job exits 2, never 1

## Plan
1.

## History
- [2026-11-03 03:56] (created) bug — wait.mjs misreports a running job: it printed running 57s applying, then its Bash call moved itself to the background and exited 1 with no v
- [2026-11-03 04:04] (comment) criterion added: wait.mjs ends inside its tool window with exit 2 and the running line; a stripped console, signal or loop throw on a pending job exits 2, never 1
- [2026-11-03 04:04] (status) todo → review
- [2026-11-03 04:06] (landed) e47fa26 wait.mjs never exits 1 for a pending job: --tool-timeout clamps the wait inside the Bash window; EPIPE, signals and loop
