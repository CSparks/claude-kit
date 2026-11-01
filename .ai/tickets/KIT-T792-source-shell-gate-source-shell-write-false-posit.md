---
id: KIT-T792
title: source-shell-gate (source-shell-write) false positive: in dirt-empire it blocked a patch worker running node <session scratchpad>/t264-build
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:30:34Z
updated: 2026-11-01T19:35:00Z
---

## Description
source-shell-gate (source-shell-write) false positive: in dirt-empire it blocked a patch worker running node <session scratchpad>/t264-build-game2.mjs and flagged crates/dirt-empire/src/nature/cell_draw.rs, but the script only reads that tree file and writes an envelope into the scratchpad. This blocks the documented 'rebuild the envelope from HEAD' patch-worker step. A scratchpad script that writes only scratchpad paths should count as a reader of tree files (report from dirt-empire-83, unverified)

kit-bug-shape: cap:bug:source-shell-gate-source-shell-write-false-posit
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 19:30] (created) bug — source-shell-gate (source-shell-write) false positive: in dirt-empire it blocked a patch worker running node <session scratchpad>/t264-build
- [2026-11-01 19:30] (status) todo → doing
- [2026-11-01 19:35] (status) doing → review
- [2026-11-01 19:35] (landed) a315e09 source-shell-gate: a scratch script is judged by the paths its write calls aim at, so one that reads a source file and w
