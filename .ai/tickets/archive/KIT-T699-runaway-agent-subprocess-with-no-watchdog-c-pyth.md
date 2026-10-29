---
id: KIT-T699
title: Runaway agent subprocess with no watchdog: 'C:\Python314\python.exe -' (a script fed on stdin, PID 69548) has used 100% of a core since 2026
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T670]
files: []
supersedes: KIT-T670
superseded_by:
created: 2026-10-29T15:01:31Z
updated: 2026-10-29T15:48:47Z
regressed_from: KIT-T584
fixed_commit: 657ebce
---

## Description
Runaway agent subprocess with no watchdog: 'C:\Python314\python.exe -' (a script fed on stdin, PID 69548) has used 100% of a core since 2026-10-28 17:18 local, about 17 h, plus ~1.7 MB/s of disk IO. Chain: python#69548 <- bash#57700 <- bash#52492 <- bash#47980 <- claude.exe#27372 (a live session started 2026-10-27 16:10, --plugin-dir D:\dev\claude-kit). No kit mechanism caps the wall-clock or CPU of a tool subprocess, or notices one running past KIT-D104's 5-minute ceiling. Need: (1) which script it is and why it spins; (2) why the Bash tool's timeout did not kill it (was it run_in_background?); (3) a kit watchdog that finds agent-spawned processes past the KIT-D104 ceiling, kills them or files a bug and alerts. Maintainer 2026-10-29: 'That needs to be raised as an issue and someone needs to figure it out, because that's not acceptable.'

Checked as possible duplicates and judged different work (--not-dup): KIT-T697

kit-bug-shape: cap:bug:runaway-agent-subprocess-with-no-watchdog-c-pyth
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 15:01] (created) bug — Runaway agent subprocess with no watchdog: 'C:\Python314\python.exe -' (a script fed on stdin, PID 69548) has used 100% of a core since 2026
- [2026-10-29 15:48] (status) todo → done
- [2026-10-29 15:48] (status) done → done
