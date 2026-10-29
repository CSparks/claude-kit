---
id: KIT-T537
title: Hung background shells: agents run 'python3 - <<EOF ... || echo nopy' on Windows; C:\Users\Chris Sparks\bin\python3.exe never returns on her
type: bug
status: superseded
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T699
created: 2026-10-16T14:48:30Z
updated: 2026-10-16T14:48:30Z
---

## Description
Hung background shells: agents run 'python3 - <<EOF ... || echo nopy' on Windows; C:\Users\Chris Sparks\bin\python3.exe never returns on heredoc stdin, so the shell hangs forever (4 seen 2026-10-16 from session 94a9137a, 10-14..10-15, plus an until-loop poller on /tmp/sub1.res with no timeout). Fix: guard against or block python3 heredocs on win32 in the bash hook, require a timeout on until/sleep pollers, and have orient offer to kill orphan shells it lists.

kit-bug-shape: cap:bug:hung-background-shells-agents-run-python3-eof-ec
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 14:48] (created) bug — Hung background shells: agents run 'python3 - <<EOF ... || echo nopy' on Windows; C:\Users\Chris Sparks\bin\python3.exe never returns on her
- [2026-10-16 14:48] (comment) seen again in dirt-empire: Hung background shells: agents run 'python3 - <<EOF ... || echo nopy' on Windows; C:\Users\Chris Sparks\bin\python3.exe never returns on heredoc stdin, so the shell hangs forever (4 seen 2026-10-16 from session 94a9137a, 10-14..10-15, plus an until-loop poller on /tmp/sub1.res with no timeout). Fix:
- [2026-10-16 14:48] (asked again) 2026-10-16 — cap:bug:hung-background-shells-agents-run-python3-eof-ec
- [2026-10-29 15:48] (status) → superseded (by KIT-T699)
