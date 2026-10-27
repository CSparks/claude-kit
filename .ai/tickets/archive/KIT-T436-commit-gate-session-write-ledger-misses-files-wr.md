---
id: KIT-T436
title: commit-gate session write ledger misses files written by Bash/node scripts, so agents routinely override it with [commit-foreign: …] for their own edits (KIT-T355 and KIT-T353 runs 2026-10-12 both did); the override becomes habit and stops catching real foreign edits
type: bug
status: done
priority: high
milestone:
labels: [lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T02:31:02Z
updated: 2026-10-27T22:27:25Z
fixed_commit: bed2b5f
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a file written by a Bash/PowerShell/node call counts as this session's own in the commit-gate ledger; another session's or out-of-session edits still block

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T407, KIT-T219, KIT-T075
### comment #1 [2026-10-13 02:34] @claude
Landed bed2b5f: hooks/shell-writes.mjs (Pre stamps start, Post one git status, records dirty paths with mtime >= start). hooks/shell-writes.test.mjs 7 passed incl. negative controls; commit-gate 38, wait-poll 21 passed. fixed_commit bed2b5f

## History
- [2026-10-13 02:31] (created) bug — commit-gate session write ledger misses files written by Bash/node scripts, so agents routinely override it with [commit-foreign: …] for their own edits (KIT-T355 and KIT-T353 runs 2026-10-12 both did); the override becomes habit and stops catching real foreign edits
- [2026-10-13 02:34] (comment) criterion added: a file written by a Bash/PowerShell/node call counts as this session's own in the commit-gate ledger; another session's or out-of-session edits still block
- [2026-10-13 02:34] (comment) ticked: a file written by a Bash/PowerShell/node call counts as this session's own in the commit-gate ledger; another session's or out-of-session edits still block
- [2026-10-13 02:34] (comment) @claude: Landed bed2b5f: hooks/shell-writes.mjs (Pre stamps start, Post one git status, records dirty paths with mtime >= start). (full comment #1 in ## Notes)
- [2026-10-13 02:34] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
