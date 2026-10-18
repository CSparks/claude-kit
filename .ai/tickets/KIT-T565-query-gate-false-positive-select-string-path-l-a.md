---
id: KIT-T565
title: query-gate false positive: Select-String -Path $l (a log through a variable) was blocked as source-discovery because -Pattern matched the bundled short-flag regex for -r
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-18T03:36:30Z
updated: 2026-10-18T03:46:10Z
---

## Description
Chris 2026-10-17: a search of one named non-source file must pass. Cause: RECURSIVE_FLAG reads PowerShell's whole-name parameters as bundled short flags (-Pattern contains r). Select-String/sls is now tree-wide only with -Recurse, a wildcard or a directory path. hooks/query-gate.test.mjs: variable log passes, sls with alternation passes, negative controls (source wildcard, grep -rn src/) still block.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T564
query-gate: Select-String and sls are tree-wide only with -Recurse, a wildcard or a directory path; hooks/query-gate.test.mjs all pass, with negative controls

## History
- [2026-10-18 03:36] (created) bug — query-gate false positive: Select-String -Path $l (a log through a variable) was blocked as source-discovery because -Pattern matched the bundled short-flag regex for -r
- [2026-10-18 03:46] (status) todo → review
