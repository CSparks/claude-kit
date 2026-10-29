---
id: KIT-T633
title: Session background monitors outlive their session: on 2026-10-23 four stiletto broker-watch loops (watch.sh/watch13.sh, session 3221b1ce, st
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T697
created: 2026-10-23T17:37:07Z
updated: 2026-10-29T15:48:37Z
---

## Description
Session background monitors outlive their session: on 2026-10-23 four stiletto broker-watch loops (watch.sh/watch13.sh, session 3221b1ce, started 2026-10-16, each forking node/grep/sha1sum every 20 s for 7 days, ~4 CPU-hours each) and nine tail -f | grep pipelines (dirt-empire session 94a9137a, 2026-10-10; stiletto 2026-10-16) were still running. Root cause: nothing reaps Bash run_in_background / scratchpad watch loops when the owning session ends; orient flags ORPHAN shells only for the current session. Need: record every background monitor's pid in agents.jsonl and have SessionStart/Stop reap any whose owning session is gone.

kit-bug-shape: cap:bug:session-background-monitors-outlive-their-sessio
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-23 17:37] (created) bug — Session background monitors outlive their session: on 2026-10-23 four stiletto broker-watch loops (watch.sh/watch13.sh, session 3221b1ce, st
- [2026-10-29 15:16] (status) → superseded (by KIT-T697)
- [2026-10-29 15:48] (status) superseded → done
