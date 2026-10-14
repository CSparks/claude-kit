---
id: KIT-T485
title: Build output grows without bound on the dev box: stiletto target/debug/deps holds 60,921 artifacts (~566.7 GB, SessionStart nag 2026-10-14); Chris recalls terabytes across repos. Needs measurement across every target, the causes (incremental churn, feature flips, per-tool target dirs, run snapshots, broker target) and a kept-bounded mechanism, not a one-off clean
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T19:01:36Z
updated: 2026-10-14T19:01:36Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 19:01] (created) bug — Build output grows without bound on the dev box: stiletto target/debug/deps holds 60,921 artifacts (~566.7 GB, SessionStart nag 2026-10-14); Chris recalls terabytes across repos. Needs measurement across every target, the causes (incremental churn, feature flips, per-tool target dirs, run snapshots, broker target) and a kept-bounded mechanism, not a one-off clean
- [2026-10-14 19:01] (comment) @claude: Chris 2026-10-14 verbatim: 'We also need to be taking a look at how much junk is accumulating from builds. Last check-in (full comment #1 in ## Notes)
### comment #1 [2026-10-14 19:01] @claude
Chris 2026-10-14 verbatim: 'We also need to be taking a look at how much junk is accumulating from builds. Last check-in there were I think terabytes of bullshit.' Read-only sonnet researcher measuring now (stiletto-2349-2a).
