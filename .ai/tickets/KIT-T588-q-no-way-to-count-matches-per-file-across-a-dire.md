---
id: KIT-T588
title: q: no way to count matches per file across a directory, or search sibling repos (HOD, Stiletto) for a survey; a DE-T172 agent fell back to t
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T22:42:16Z
updated: 2026-10-20T00:52:55Z
fixed_commit: b6dd07f
---

## Description
q: no way to count matches per file across a directory, or search sibling repos (HOD, Stiletto) for a survey; a DE-T172 agent fell back to the Grep tool and node file scans instead (process failure, 2026-10-19)

kit-bug-shape: cap:feature:q-no-way-to-count-matches-per-file-across-a-dire
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 22:42] (created) feature — q: no way to count matches per file across a directory, or search sibling repos (HOD, Stiletto) for a survey; a DE-T172 agent fell back to t
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) q code --dir <path> (any directory or file, per-file counts with -c) and --project <name prefix>; test scripts/q-gaps.test.mjs (10 passed). Uncommitted scratch files were already indexed (untracked files are listed); the gap was gitignored and out-of-repo paths, which --dir covers
