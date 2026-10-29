---
id: KIT-T697
title: Recurrence of KIT-T634 (orphaned children cause input lag), new shape: Monitor-style 'tail -n 0 -F <broker daemon log> | grep -E --line-buff
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T633
superseded_by:
created: 2026-10-29T14:59:23Z
updated: 2026-10-29T15:48:46Z
fixed_commit: 1c442c6
---

## Description
Recurrence of KIT-T634 (orphaned children cause input lag), new shape: Monitor-style 'tail -n 0 -F <broker daemon log> | grep -E --line-buffered "→ landed|suite .* →|crash|HEALTH"' pipelines against D:/dev/dirt-empire/target/broker/logs, re-armed about every 30 min 2026-10-28 13:40-23:52 plus 10-29 09:58. Each pipeline's parent shell exited, leaving 23 tail.exe + 22 grep.exe orphans alive (dead parents), with tail -F polling the D: HDD. Measured 2026-10-29: the greps use about 20% of one core in total, the D: disk is 35% busy, and the maintainer reports sluggish input. Root cause: the orchestrator watches the broker by tailing logs instead of using broker/wait.mjs, and when the watcher ends the pipeline is not killed. Fix: (1) steer broker-watching to wait.mjs, with a gate on 'tail -F .*broker/logs'; (2) orient/flush reaps tail/grep with a dead parent; (3) do the same reap for KIT-T634's grep -r case.

kit-bug-shape: cap:bug:recurrence-of-kit-t634-orphaned-children-cause-i
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 14:59] (created) bug — Recurrence of KIT-T634 (orphaned children cause input lag), new shape: Monitor-style 'tail -n 0 -F <broker daemon log> | grep -E --line-buff
- [2026-10-29 15:16] (status) todo → done
- [2026-10-29 15:48] (status) done → done
