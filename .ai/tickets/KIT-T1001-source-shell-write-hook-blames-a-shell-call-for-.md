---
id: KIT-T1001
title: source-shell-write hook blames a shell call for files other parallel agents edited in the same checkout (hit by pixelvision music agent runn
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:44:13Z
updated: 2026-11-11T03:44:13Z
---

## Description
source-shell-write hook blames a shell call for files other parallel agents edited in the same checkout (hit by pixelvision music agent running only t/q; files: MediaContainerDto.kt, MediaDetails.kt, GameHud.kt, PvSpinner.kt)

kit-bug-shape: cap:bug:source-shell-write-hook-blames-a-shell-call-for-
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:44] (created) bug — source-shell-write hook blames a shell call for files other parallel agents edited in the same checkout (hit by pixelvision music agent runn
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
- [2026-11-11 04:36] (landed) ea3678f inert-command: node --test counts only among node's own options in a repo test run with no preload; an untrusted line fa
- [2026-11-11 04:36] (comment) @claude: Landed a2cb5a3 + ea3678f (covers KIT-T888, T941, T1003, T1004): lib/inert-command.mjs rules a call out by what it can wr (full comment #1 in ## Notes)
### comment #1 [2026-11-11 04:36] @claude
Landed a2cb5a3 + ea3678f (covers KIT-T888, T941, T1003, T1004): lib/inert-command.mjs rules a call out by what it can write; bash escapes settle cap/t/q quoting. hooks/shell-attribution.test.mjs 30 passed, hooks/source-shell-gate-escapes.test.mjs 11, hooks/shell-segments.test.mjs 41, hooks/source-shell-gate.test.mjs 167, hooks/hand-write-detect.test.mjs 69. [publish blocked: exported HEAD red on hooks/claim-release-controls.test.mjs]
