---
id: KIT-T536
title: t session --file <draft> --append hangs on runtime 1a92179 (stiletto-2349, 2026-10-15 19:08 local): SESSION.md is appended and the backup wr
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T00:13:25Z
updated: 2026-10-16T00:13:25Z
---

## Description
t session --file <draft> --append hangs on runtime 1a92179 (stiletto-2349, 2026-10-15 19:08 local): SESSION.md is appended and the backup written, then the child 'node index-tickets.mjs D:\dev\stiletto-2349' (pid 32360, parent t.mjs 49404) sits at 0.4 s CPU with no children for >2 min until killed. Run on its own from bash with stdin </dev/null the same index-tickets.mjs finishes in <40 s ('q: cache was stale — rehydrated'). Suspect: the child waits on an inherited stdin pipe or the q cache lock held by the parent. On 0211268 the same command returned in seconds. Workaround used: kill both pids; the append had already landed. --priority high

kit-bug-shape: cap:bug:t-session-file-draft-append-hangs-on-runtime-1a9
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-16 00:13] (created) bug — t session --file <draft> --append hangs on runtime 1a92179 (stiletto-2349, 2026-10-15 19:08 local): SESSION.md is appended and the backup wr
