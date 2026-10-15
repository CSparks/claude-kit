---
id: KIT-T519
title: Broker Cargo.lock restore is unproven: KIT-T482 vetting saw 'dirt-from-own-run: rust/Cargo.lock changed by job j-mv8ly4le' (2026-10-14); BROKER.md now says every Cargo.lock is journalled, but no test shows a check-only run that rewrites Cargo.lock (and a killed mid-run one) leaves it byte-identical
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:28:30Z
updated: 2026-10-15T17:28:30Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T493, KIT-T496
### comment #1 [2026-10-15 17:28] @claude
Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from zero (KIT-T518), Cargo.lock restore unproven (KIT-T519), a stale queued --pin moving a gitlink backwards (KIT-T515)).

## History
- [2026-10-15 17:28] (created) bug — Broker Cargo.lock restore is unproven: KIT-T482 vetting saw 'dirt-from-own-run: rust/Cargo.lock changed by job j-mv8ly4le' (2026-10-14); BROKER.md now says every Cargo.lock is journalled, but no test shows a check-only run that rewrites Cargo.lock (and a killed mid-run one) leaves it byte-identical
- [2026-10-15 17:28] (comment) @claude: Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from ze (full comment #1 in ## Notes)
