---
id: KIT-T280
title: query-gate store-grep false positive on tail/mv/mkdir (verify)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:04:11Z
updated: 2026-10-02T15:07:37Z
---

## Description
CONFIRMED real false positive, reproduced live twice. query-gate segments() split on | & ; but not newline, so 'x | tail -1' + newline + 'git add .ai/tickets/KIT-T277*' was judged as one piped tail with a store path (glob, not a single named file) -> store-grep block, though nothing searched the store. Same defect is a bypass: 'echo hi' + newline + 'grep -rn x .ai/decisions/' passed. Reason for the change: segmentation now treats newline as ';' and does not split on the '&' of 2>&1 or &>; detection of grep/rg/cat/sed/head/tail on store paths is unchanged. Tests: hooks/query-gate.test.mjs KIT-T280 block (2 fail before, pass after).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] newline and 2>&1 no longer glue a piped tail to the next command's store path; real store greps still block

## Plan
1.

## History
- [2026-10-02 15:04] (created) bug — query-gate store-grep false positive on tail/mv/mkdir (verify)
- [2026-10-02 15:07] (comment) criterion added: newline and 2>&1 no longer glue a piped tail to the next command's store path; real store greps still block
- [2026-10-02 15:07] (comment) ticked: newline and 2>&1 no longer glue a piped tail to the next command's store path; real store greps still block
- [2026-10-02 15:07] (status) todo → review
