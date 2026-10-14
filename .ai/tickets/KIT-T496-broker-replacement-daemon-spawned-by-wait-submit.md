---
id: KIT-T496
title: broker replacement daemon spawned by wait/submit (restartIfWedged, ensureBroker) runs as a child of a worker's Bash shell with stdio ignored: no log, and it dies or orphans with that shell; it must be fully detached (no parent shell) and log to target/broker/logs
type: bug
status: superseded
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by: KIT-T495
created: 2026-10-14T21:42:37Z
updated: 2026-10-14T22:01:22Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T271, KIT-T488, KIT-T493
### comment #1 [2026-10-14 22:01] @claude
Fixed: launch.mjs starts replacement daemons via Win32_Process.Create (hidden, outside the caller's tree and job object; detached elsewhere) with --log auto -> target/broker/logs/daemon-<time>-<pid>.log; used by ensure.spawnBroker (wait/submit) and the runtime-gone restart. scripts/broker/watchdog.test.mjs 5 passed (a landing whose pre-push gate outlasts stall_kill_s 1 keeps its beat under 2.5 s and restartIfWedged refuses to kill it; negative control: the same watchdog kills a daemon stalled in a run phase and the kill lands in the result once; a SIGKILL after commit leaves the tree at the commit and the restart pushes it, result resumed; negative control: the same journal without the commit marker reverses the tree), launch.test.mjs 3 passed (live: Win32_Process.Create daemon writes target/broker/logs/daemon-*.log and is not the caller's child). Mutation: the pre-push gate back on spawnSync fails the beat test. npm test exit 0, broker 193 passed.

## History
- [2026-10-14 21:42] (created) bug — broker replacement daemon spawned by wait/submit (restartIfWedged, ensureBroker) runs as a child of a worker's Bash shell with stdio ignored: no log, and it dies or orphans with that shell; it must be fully detached (no parent shell) and log to target/broker/logs
- [2026-10-14 22:01] (comment) @claude: Fixed: launch.mjs starts replacement daemons via Win32_Process.Create (hidden, outside the caller's tree and job object; (full comment #1 in ## Notes)
- [2026-10-14 22:01] (status) todo → review
- [2026-10-14 22:22] (status) → superseded (by KIT-T495)
