---
id: KIT-T432
title: Dispatch picks opus too often: the orchestrator hand-picks escalated job ids (forensic/build/design -> opus) for work the ticket type routes
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T20:51:17Z
updated: 2026-10-12T21:01:17Z
---

## Description
Dispatch picks opus too often: the orchestrator hand-picks escalated job ids (forensic/build/design -> opus) for work the ticket type routes to sonnet (bug/feature -> fix). Chris 2026-10-12, verbatim: 'Whatever is deciding what model to use seems to be overly fucking aggressive. I know sonnet can do some of the things I see being worked on.' Evidence from stiletto 2026-10-12: deposit/needle diagnosis dispatched as forensic (opus; forensic's row says regression first pass), mine-site trace as forensic (opus; research/sonnet fits), ST-T888 bug fix as build (opus; bug default = fix/sonnet). Want: dispatch-guard resolves the job from the linked ticket's type (default_job) and BLOCKS a job that outranks it unless the prompt carries [escalate: <reason>]; forensic only for type regression or a failed first pass; read-only diagnosis defaults to research (sonnet). Record a kit decision citing Chris's quote.

kit-bug-shape: cap:feature:dispatch-picks-opus-too-often-the-orchestrator-h
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 20:51] (created) feature — Dispatch picks opus too often: the orchestrator hand-picks escalated job ids (forensic/build/design -> opus) for work the ticket type routes
- [2026-10-12 21:01] (status) todo → review
