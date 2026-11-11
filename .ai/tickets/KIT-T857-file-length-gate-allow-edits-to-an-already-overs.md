---
id: KIT-T857
title: file-length gate: allow edits to an already-oversized file that do not grow it (net lines <= 0) or add <= 3 lines delegating to a new file;
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T01:46:46Z
updated: 2026-11-05T01:52:43Z
---

## Description
file-length gate: allow edits to an already-oversized file that do not grow it (net lines <= 0) or add <= 3 lines delegating to a new file; today any edit to a 1000+ line file is blocked, forcing a refactor-first detour (groovegrid GG-T157, TrackOperations.cpp 1006 lines, TracksList.cpp 1975 lines; Chris 2026-11-04: self-defeating)

kit-bug-shape: cap:feature:file-length-gate-allow-edits-to-an-already-overs
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-05 01:46] (created) feature — file-length gate: allow edits to an already-oversized file that do not grow it (net lines <= 0) or add <= 3 lines delegating to a new file;
- [2026-11-05 01:50] (landed) 1f6b991 file-length gate: an edit to an already-oversized file passes when it adds <= 3 net lines; growth beyond that and under-
- [2026-11-05 01:52] (comment) @claude: Landed 1f6b991, published runtime 1f6b991. fileLengthVerdict (hooks/lib/limits.mjs): over-hard file edits pass at net <= (full comment #1 in ## Notes)
### comment #1 [2026-11-05 01:52] @claude
Landed 1f6b991, published runtime 1f6b991. fileLengthVerdict (hooks/lib/limits.mjs): over-hard file edits pass at net <= 3 lines; larger growth and under->over still block; 300 warn and exclusions unchanged. exclusions.test.mjs: 6 new file-length cases pass; pre-write.test.mjs all pass.
- [2026-11-05 01:52] (status) todo → review
