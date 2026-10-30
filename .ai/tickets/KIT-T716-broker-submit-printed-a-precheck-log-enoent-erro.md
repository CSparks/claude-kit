---
id: KIT-T716
title: broker submit printed a precheck-log ENOENT error on a --land submit (dirt-empire j-mvu4lpjt-8ex1fr, DE-T209 truck split) yet the job still
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T22:42:26Z
updated: 2026-10-29T22:42:26Z
---

## Description
broker submit printed a precheck-log ENOENT error on a --land submit (dirt-empire j-mvu4lpjt-8ex1fr, DE-T209 truck split) yet the job still queued; the precheck log path is not created before it is read.

kit-bug-shape: cap:bug:broker-submit-printed-a-precheck-log-enoent-erro
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 22:42] (created) bug — broker submit printed a precheck-log ENOENT error on a --land submit (dirt-empire j-mvu4lpjt-8ex1fr, DE-T209 truck split) yet the job still
- [2026-10-30 00:01] (comment) @claude: Recurring and costly: on 2026-10-29/30 the precheck-log ENOENT at submit silently dropped two dirt-empire jobs (j-mvu4lp (full comment #1 in ## Notes)
### comment #1 [2026-10-30 00:01] @claude
Recurring and costly: on 2026-10-29/30 the precheck-log ENOENT at submit silently dropped two dirt-empire jobs (j-mvu4lpjt truck land, j-mvu5ufcr race check). Each printed a job id, never queued and never wrote a result, so the orchestrator waited on jobs that did not exist. Submit must either queue the job or exit non-zero; never print an id for a job it did not queue.
- [2026-10-30 01:16] (comment) @claude: Repro 2026-10-30 dirt-empire DE-T234: three consecutive submits crashed (exit 1) with ENOENT reading target/broker/prech (full comment #2 in ## Notes)
### comment #2 [2026-10-30 01:16] @claude
Repro 2026-10-30 dirt-empire DE-T234: three consecutive submits crashed (exit 1) with ENOENT reading target/broker/precheck-<id>.log (twice) and precheck-<id>-full.log (once, after the narrow stage passed exit 0). None queued. precheck.mjs cargoChecks reads the log after run() without checking it exists; blocks DE-T234 de5.
- [2026-10-30 01:19] (comment) @claude: Root cause: runCancellable's runOnce returns before opening the log when a cancel (deadline) lands during the build-slot (full comment #3 in ## Notes)
### comment #3 [2026-10-30 01:19] @claude
Root cause: runCancellable's runOnce returns before opening the log when a cancel (deadline) lands during the build-slot wait, so cargoChecks read a log that never existed (narrow stage and full stage alike). Fixed: runOnce leaves an empty log on a slot cancel, cargoChecks reads a missing log as empty, and precheckJob is fail-open (a crash inside it prints a stderr line and the job queues). Submit therefore either queues the job or exits before printing an id. Test: scripts/broker/precheck-missing-log.test.mjs 4 passed (3 fail without the fix); precheck 8, precheck-guards 12, precheck-scope 3, file-lock 5, link-recover 3 passed.
