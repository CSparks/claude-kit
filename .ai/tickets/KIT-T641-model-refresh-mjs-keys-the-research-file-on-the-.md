---
id: KIT-T641
title: model-refresh.mjs keys the research file on the UTC date (toISOString, line 96) while the reassessment doc is written on the local date: res
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T02:54:53Z
updated: 2026-10-27T02:54:53Z
---

## Description
model-refresh.mjs keys the research file on the UTC date (toISOString, line 96) while the reassessment doc is written on the local date: research/models-capability-2026-10-26.md written 16:49 local is refused at 19:54 local because UTC is already 2026-10-27; root cause: mixed local/UTC date conventions between the writer and model-refresh

kit-bug-shape: cap:bug:model-refresh-mjs-keys-the-research-file-on-the-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 02:54] (created) bug — model-refresh.mjs keys the research file on the UTC date (toISOString, line 96) while the reassessment doc is written on the local date: res
- [2026-10-27 03:00] (comment) @claude: Fix: model-refresh.mjs names the research doc by the local date (localDate), matching its author; tests switched off the (full comment #1 in ## Notes)
### comment #1 [2026-10-27 03:00] @claude
Fix: model-refresh.mjs names the research doc by the local date (localDate), matching its author; tests switched off the UTC date (they failed whenever UTC and local dates differed). model-refresh 24, job-capability 24 passed.
