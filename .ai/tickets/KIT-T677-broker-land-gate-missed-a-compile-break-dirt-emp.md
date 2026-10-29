---
id: KIT-T677
title: broker land gate missed a compile break: dirt-empire ab5a964 (j-mvsj7sn5, DE-T195) added FeatureKind variants and landed although tests/gene
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T21:18:38Z
updated: 2026-10-28T22:33:41Z
---

## Description
broker land gate missed a compile break: dirt-empire ab5a964 (j-mvsj7sn5, DE-T195) added FeatureKind variants and landed although tests/generated_courses.rs has an exhaustive match on FeatureKind; the next job's 'cargo check --workspace --all-targets' failed E0004. The affected gate must compile every target that depends on a changed enum (or all targets) before land.

kit-bug-shape: cap:bug:broker-land-gate-missed-a-compile-break-dirt-emp
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Under land_gate: affected a landing with its own --test commands also runs the all-targets affected.check first (landgate-explicit.test.mjs)

## Plan
1.

## Notes
Tests: scripts/broker/landgate-explicit.test.mjs + landgate.test.mjs + land-gate.test.mjs + suite.test.mjs 18 passed.
Second route closed: a landing that reuses a green check-only run (green cache) skipped the gate entirely, so a scoped --test check followed by --land could land a break in an unbuilt target. patch.mjs compileCheckMissing now runs affected.check on a reused landing under land_gate: affected. landgate-reuse.test.mjs 2 passed.

## History
- [2026-10-28 21:18] (created) bug — broker land gate missed a compile break: dirt-empire ab5a964 (j-mvsj7sn5, DE-T195) added FeatureKind variants and landed although tests/gene
- [2026-10-28 22:18] (comment) criterion added: Under land_gate: affected a landing with its own --test commands also runs the all-targets affected.check first (landgate-explicit.test.mjs)
- [2026-10-28 22:18] (comment) ticked: Under land_gate: affected a landing with its own --test commands also runs the all-targets affected.check first (landgate-explicit.test.mjs)
- [2026-10-28 22:33] (status) todo → review
