---
id: KIT-T731
title: hand-write-detect flags file DELETIONS as hand writes: git rm / rm -rf of source (maintainer-ordered test-suite removal in daemonelectricity
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T21:30:03Z
updated: 2026-10-30T21:33:29Z
---

## Description
hand-write-detect flags file DELETIONS as hand writes: git rm / rm -rf of source (maintainer-ordered test-suite removal in daemonelectricity) trips 'HAND WRITE ... re-save through Edit or Write', which a deleted file cannot satisfy, and poisons the commit gate. A path absent after the shell call is a deletion, not a hand write.

kit-bug-shape: cap:bug:hand-write-detect-flags-file-deletions-as-hand-w
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: handWrittenSources drops paths gone after the call; pendingHandWrites ignores ledgered files no longer on disk. Evidence: hooks/hand-write-detect.test.mjs 30 passed (unlinkSync/rm of source now negative controls), hooks/commit-gate.test.mjs 42 passed.

## History
- [2026-10-30 21:30] (created) bug — hand-write-detect flags file DELETIONS as hand writes: git rm / rm -rf of source (maintainer-ordered test-suite removal in daemonelectricity
- [2026-10-30 21:33] (status) todo → review
- [2026-10-30 21:33] (landed) 1c161fd A shell deletion is not a hand write; ledgered files deleted later stop blocking commits; implements KIT-T731
