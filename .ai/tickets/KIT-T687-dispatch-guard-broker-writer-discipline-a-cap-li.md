---
id: KIT-T687
title: dispatch-guard: broker-writer discipline: (a) cap live writer agents per checkout (default 3), (b) require [paths:] on a writer dispatch and
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:28:30Z
updated: 2026-10-29T00:39:45Z
---

## Description
dispatch-guard: broker-writer discipline: (a) cap live writer agents per checkout (default 3), (b) require [paths:] on a writer dispatch and refuse overlap with a live writer's paths, (c) inject the train-eligibility rules (no --pin, Cargo.toml in its own job, disjoint paths, no cargo, no compile-by-queue) into patch-worker briefs and warn when a brief tells an agent to pin. patch-worker.md today says 'Confident of a small change -> submit --land straight away', which invites compiling through the queue (28 of 35 compile errors in dirt-empire 2026-10-28 surfaced in a scoped --test command)

kit-bug-shape: cap:feature:dispatch-guard-broker-writer-discipline-a-cap-li
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: hooks/dispatch-worker.mjs (check patch-worker-discipline): writer cap broker.writer_cap default 3, [paths:] required ([paths: *] = unknown), overlap with a live worker refused (roster rows now record paths), train rules printed on every allowed dispatch, pin-instruction warning when auto_pin is on; escape is the maintainer-asked-parallel token. The rules ride the patch-worker definition too (agents/patch-worker.md): a PreToolUse hook cannot rewrite a brief. Tests: hooks/dispatch-worker.test.mjs 22 passed, dispatch-broker/dispatch-guard/agent-roster/dispatch-ui suites green.

## History
- [2026-10-28 22:28] (created) feature — dispatch-guard: broker-writer discipline: (a) cap live writer agents per checkout (default 3), (b) require [paths:] on a writer dispatch and
- [2026-10-29 00:39] (status) todo → review
