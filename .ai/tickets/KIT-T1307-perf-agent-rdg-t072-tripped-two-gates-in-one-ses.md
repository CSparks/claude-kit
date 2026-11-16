---
id: KIT-T1307
title: Perf agent RDG-T072 tripped two gates in one session: a Bash tree grep for rayon/ComputeTaskPool (source-discovery) and a node -e script rew
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T09:21:20Z
updated: 2026-11-16T10:06:44Z
---

## Description
Perf agent RDG-T072 tripped two gates in one session: a Bash tree grep for rayon/ComputeTaskPool (source-discovery) and a node -e script rewriting expand.rs (source-shell-write). Root cause: the agent system prompt names q and Edit but the habit path was grep and scripted bulk edits; prevention candidate: dispatch brief template for fix/perf jobs repeats 'q not grep; Edit not scripts'.

kit-bug-shape: cap:bug:perf-agent-rdg-t072-tripped-two-gates-in-one-ses:8b5d506e
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-16 09:21] (created) bug — Perf agent RDG-T072 tripped two gates in one session: a Bash tree grep for rayon/ComputeTaskPool (source-discovery) and a node -e script rew
- [2026-11-16 10:06] (status) todo → review
