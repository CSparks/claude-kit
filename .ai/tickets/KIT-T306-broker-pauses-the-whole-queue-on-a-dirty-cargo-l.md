---
id: KIT-T306
title: broker pauses the whole queue on a dirty Cargo.lock that cargo itself rewrote in the live checkout (the maintainer's cargo r / editor resolv
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T16:34:49Z
updated: 2026-10-03T16:39:00Z
---

## Description
broker pauses the whole queue on a dirty Cargo.lock that cargo itself rewrote in the live checkout (the maintainer's cargo r / editor resolves new workspace members after a submodule pin lands), and the job that would commit that very lock can never run: the maintainer had to be asked to git checkou

kit-bug-shape: cap:bug:broker-pauses-the-whole-queue-on-a-dirty-cargo-l
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a modified Cargo.lock does not pause; check-only/failed runs restore it byte for byte; green landing commits it; idle deferred re-check restores locks

## Plan
1.

## History
- [2026-10-03 16:34] (created) bug — broker pauses the whole queue on a dirty Cargo.lock that cargo itself rewrote in the live checkout (the maintainer's cargo r / editor resolv
- [2026-10-03 16:38] (comment) criterion added: a modified Cargo.lock does not pause; check-only/failed runs restore it byte for byte; green landing commits it; idle deferred re-check restores locks
- [2026-10-03 16:38] (comment) ticked: a modified Cargo.lock does not pause; check-only/failed runs restore it byte for byte; green landing commits it; idle deferred re-check restores locks
- [2026-10-03 16:39] (comment) @sonnet55: root cause: the idle deferred re-check (deferred.mjs) ran cargo in the live tree outside any journal, rewriting Cargo.lo (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:39] @sonnet55
root cause: the idle deferred re-check (deferred.mjs) ran cargo in the live tree outside any journal, rewriting Cargo.lock after the job; fixed with guardLocks; dirty Cargo.lock no longer pauses. Evidence 2a61906, broker suite 66 passed, mutation fails 6
- [2026-10-03 16:39] (status) todo → review
