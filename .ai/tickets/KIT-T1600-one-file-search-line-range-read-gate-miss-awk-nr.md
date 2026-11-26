---
id: KIT-T1600
title: one-file-search / line-range read gate miss: `awk 'NR==377' scripts/t.mjs` (a line read of one named source file by line number) passed the
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:31:36Z
updated: 2026-11-26T06:02:55Z
---

## Description
one-file-search / line-range read gate miss: `awk 'NR==377' scripts/t.mjs` (a line read of one named source file by line number) passed the retrieval gate; readsOneFile covers head, tail and sed -n ranges, and awk only with a /pattern/ address, so an awk NR==N or NR>=a&&NR<=b line read of one file goes unblocked. Seen 2026-11-26 by the KIT-T1594 follow-up agent.

kit-bug-shape: cap:bug:one-file-search-line-range-read-gate-miss-awk-nr:94bdb556
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: readsOneFile (hooks/lib/one-file-search.mjs) treats an awk program made only of NR/FNR line tests joined by && or ||, with no body or a print body of $0, NR and quoted text, on one named file as a line-range read; query-gate RULE 4 now considers awk. Tests: query-gate-one-file 78 passed 3 failed without the change (the three awk reads), 81 passed 0 failed with it; controls: awk NR on piped output and an NR filter that sums a field pass. query-gate-pipes, -build-log, -variables pass.

## History
- [2026-11-26 01:31] (created) bug — one-file-search / line-range read gate miss: `awk 'NR==377' scripts/t.mjs` (a line read of one named source file by line number) passed the
- [2026-11-26 06:02] (status) todo → review
