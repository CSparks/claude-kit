---
id: KIT-T682
title: Process failure (orchestrator, dirt-empire 2026-10-28): proposed and dispatched a broker 'merge queue / batching' redesign that ALREADY EXIS
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:12:44Z
updated: 2026-10-28T22:12:44Z
---

## Description
Process failure (orchestrator, dirt-empire 2026-10-28): proposed and dispatched a broker 'merge queue / batching' redesign that ALREADY EXISTS (trains, green cache, known-red, nextest coalescing in docs/BROKER.md) without reading BROKER.md first; also told agents to use --pin, which excludes jobs from trains. Root cause: no grounding step forces reading the broker's design doc before proposing broker changes or giving agents broker usage advice; dispatch briefs do not carry the train-eligibility rules (no --pin, no Cargo.toml, disjoint paths).

kit-bug-shape: cap:bug:process-failure-orchestrator-dirt-empire-2026-10
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 22:12] (created) bug — Process failure (orchestrator, dirt-empire 2026-10-28): proposed and dispatched a broker 'merge queue / batching' redesign that ALREADY EXIS
