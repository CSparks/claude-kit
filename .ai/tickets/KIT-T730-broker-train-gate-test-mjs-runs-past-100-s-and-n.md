---
id: KIT-T730
title: broker: train-gate.test.mjs runs past 100 s and never finishes on this box (baseline, without KIT-T729 changes); the file hangs under node -
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T19:42:25Z
updated: 2026-10-30T21:26:11Z
---

## Description
broker: train-gate.test.mjs runs past 100 s and never finishes on this box (baseline, without KIT-T729 changes); the file hangs under node --test

kit-bug-shape: cap:bug:broker-train-gate-test-mjs-runs-past-100-s-and-n
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: gateFixture repos set pre_push:true, so land.mjs->prepush.mjs acquireBuildSlot(force) queued on the machine-wide ~/.claude/claude-kit-build-slots behind a live real cargo job (pid 53292); not a hung handle. Fix: testkit.mjs sets CLAUDE_KIT_BUILD_SLOT_DIR to a private temp dir (covers every broker test importing testkit). Evidence: scripts/broker/testkit-slots.test.mjs 2 pass; train-gate.test.mjs 3 pass in ~46s (545 git spawns on this box; was >100s never finishing); train-one-gate, gate-lock, build-slot tests pass.

## History
- [2026-10-30 19:42] (created) bug — broker: train-gate.test.mjs runs past 100 s and never finishes on this box (baseline, without KIT-T729 changes); the file hangs under node -
- [2026-10-30 21:26] (status) todo → review
- [2026-10-30 21:26] (landed) bfc862b Give broker tests a private build-slot dir so gate tests never queue behind a real build; implements KIT-T730
