---
id: KIT-T834
title: orphan-shell warning lists dead task rows it can never clear (dirt-empire 2026-11-02: b09p4lucf, bjhwp93ay; TaskStop: No task found)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T18:50:48Z
updated: 2026-11-02T18:51:16Z
---

## Description
flush.mjs and orient listed task output files without an end marker as never-exited shells. The harness leaves the marker off failed tasks and tasks lost with their subagent, so the rows never cleared and TaskStop could not stop them. Fix: verify each row (finished task notification in the session transcript, command from session and subagent transcripts, OS process list) before listing; name pid, parent and command line for a live row.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T455, KIT-T704
Cause: orphan-shells.mjs treats any tasks/<id>.output without an end marker as a live shell. The harness writes no marker for a failed task (b09p4lucf: its transcript holds a task-notification status failed) or a task lost with its subagent (bjhwp93ay: a wait.mjs started by a worker; command known only in that worker's output transcript), and TaskStop answers No task found. There is no pid in any ledger; the rows are task output files under tmp/claude/<project>/<session>/tasks. Fix: hooks/orphan-verify.mjs verifyOrphans drops a row with a finished task-notification in the session transcript, fills the command from the session and subagent transcripts, and drops a known command that no OS process carries (ps, or Get-CimInstance on Windows); a live row is listed with pid, parent pid, session and command line; an unverifiable row stays flagged unverified with its output path. Wired into flush.mjs (Stop) and orient. Tests: orphan-verify 11 passed (dead rows dropped silently, live orphan with pid and command line, subagent command, injected process positive control, unreadable process list fails open), orphan-shells 18, orient 34. Not published: another writer has uncommitted q-miss edits in this checkout.
Full publish suite found two reds that predate this change (reproduced on a clean beb8b5f export; hidden because budgeted publishes never reached them): q-server (a no-hit q code printed only the NOT searched note, no '(no results)': fixed in scripts/q-print.mjs, q-server 8 passed) and lock-restore (the test wrote the tracked .ai/config.yml then asserted a clean tree: pathspec Cargo.lock, 7 passed by name).
Published: runtime 7aebf88 (KIT_TEST_FULL=1 publish at 7aebf88 HEAD, 330-file suite green, about 12 min wall under machine load). Orphan fix verified against the dirt-empire rows after publish (see report).

## History
- [2026-11-02 18:50] (created) bug — orphan-shell warning lists dead task rows it can never clear (dirt-empire 2026-11-02: b09p4lucf, bjhwp93ay; TaskStop: No task found)
- [2026-11-02 18:51] (status) todo → review
- [2026-11-02 18:51] (landed) 42866b3 Orphan-shell warning lists only rows that can be alive: a finished task notification or a command no process carries dro
- [2026-11-02 19:28] (landed) 0ab34ce A SendMessage resume naming the ticket takes the retired worker's handoff over until it retires again or stays silent 30
- [2026-11-02 19:29] (landed) 7aebf88 runner tests ignore a KIT_TEST_FULL set by the publish (implements KIT-T834)
