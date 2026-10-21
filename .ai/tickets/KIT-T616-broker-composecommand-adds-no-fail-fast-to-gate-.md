---
id: KIT-T616
title: broker composeCommand adds --no-fail-fast to gate_prebuild 'cargo t --no-run': nextest rejects it (exit 2), so any rapid-game landing that r
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T17:02:09Z
updated: 2026-10-21T18:46:05Z
---

## Description
broker composeCommand adds --no-fail-fast to gate_prebuild 'cargo t --no-run': nextest rejects it (exit 2), so any rapid-game landing that reaches a crate fails at the prebuild step --body Repro: job j-mvicplae-01edif (rapid-game, RG-T285 --land): commands 1-2 pass (rg-screens, rg-ui); command 3 = gate_prebuild 'cd rust && cargo t --no-run' composed by scripts/broker/run.mjs composeCommand (line ~37) to 'cargo t --no-run --no-fail-fast -j 3'; nextest: error: the argument '--no-run' cannot be used with '--no-fail-fast' (exit 2). Fix: composeCommand must not add --no-fail-fast when the command has --no-run (or prebuild must bypass composition). Also seen: HEALTH own-fault:restore-mismatch (line endings only) for check-only job j-mvickmph-3tyjvd on rust/ui/rg-screens/src/tests/screens.rs, and a test-only job that runs the ignored bless_goldens test leaves the written golden dirty in the checkout (journal only knew Cargo.lock), pausing the queue until reverted by hand; 'broker restore' refuses it as a hand edit.

kit-bug-shape: cap:bug:broker-composecommand-adds-no-fail-fast-to-gate-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
composeCommand (scripts/broker/run.mjs): --no-fail-fast is a run-only flag, never added to a --no-run (build-only) command or one that chose --fail-fast. New scripts/broker/own-writes.mjs sweeps a job's own unstaged writes to tracked files outside its journal (patch.mjs, train.mjs finally), keeping the discarded bytes as a blob and recording the ledger. preimage.mjs matchesPreImage: a tracked file git sees unmodified whose bytes equal the journal ignoring CR is no restore-mismatch. Tests: units.test.mjs (3 new), own-writes.test.mjs (3), restore-check.test.mjs (1, red before, green after).

## History
- [2026-10-21 17:02] (created) bug — broker composeCommand adds --no-fail-fast to gate_prebuild 'cargo t --no-run': nextest rejects it (exit 2), so any rapid-game landing that r
- [2026-10-21 17:02] (comment) seen again in stiletto-2349: broker composeCommand adds --no-fail-fast to gate_prebuild 'cargo t --no-run': nextest rejects it (exit 2); every rapid-game landing that reaches a crate fails at prebuild --body Repro job j-mvicplae-01edif (rapid-game RG-T285 --land): tests pass, command 3 = gate_prebuild composed to 'cargo t --no-
- [2026-10-21 17:02] (asked again) 2026-10-21 — cap:bug:broker-composecommand-adds-no-fail-fast-to-gate-
- [2026-10-21 18:46] (status) todo → review
