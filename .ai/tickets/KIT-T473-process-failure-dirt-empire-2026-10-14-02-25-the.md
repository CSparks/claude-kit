---
id: KIT-T473
title: Process failure (dirt-empire 2026-10-14 02:25): the orchestrator's KIT-T472 brief told the kit writer to 'use a scratch fixture repo for liv
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T07:18:31Z
updated: 2026-10-14T07:18:31Z
---

## Description
Process failure (dirt-empire 2026-10-14 02:25): the orchestrator's KIT-T472 brief told the kit writer to 'use a scratch fixture repo for live runs': a second working directory, an end-around of KIT-D039 (no clones/worktrees/second dirs). Chris: 'this multiple copies shit is what I was trying to avoid when I instantiated the one writer policy' / 'This is a fucking end around.' Corrected before the agent made one (git worktree list + D:\dev + temp checked). Root cause: dispatch-guard checks model/job/tree tokens but not the brief's content; nothing blocks a prompt that instructs a copy (scratch repo, fixture repo, clone, worktree, temp checkout). Fix: dispatch-guard rejects such instructions; patch-worker/broker design must prove changes inside the one checkout.

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-14-02-25-the
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 07:18] (created) bug — Process failure (dirt-empire 2026-10-14 02:25): the orchestrator's KIT-T472 brief told the kit writer to 'use a scratch fixture repo for liv
