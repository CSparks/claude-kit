---
id: KIT-T613
title: search-report counts grep/rg/Grep/find but not sed/awk/head/cat, so agent sed -n line-range reads and sed '/pat/p' searches are invisible to
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T15:36:01Z
updated: 2026-10-21T15:36:01Z
---

## Description
search-report counts grep/rg/Grep/find but not sed/awk/head/cat, so agent sed -n line-range reads and sed '/pat/p' searches are invisible to the q-adoption metric and ungated by query-gate (Chris 2026-10-21: 'still seeing a lot of SED calls on agents'). Add them to the tally (range read vs pattern search), gate pattern-searching sed/awk the way grep is gated, and point range reads at q code -C / Read.

kit-bug-shape: cap:feature:search-report-counts-grep-rg-grep-find-but-not-s
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 15:36] (created) feature — search-report counts grep/rg/Grep/find but not sed/awk/head/cat, so agent sed -n line-range reads and sed '/pat/p' searches are invisible to
