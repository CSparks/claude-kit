---
id: KIT-T1020
title: commit-gate commit-foreign blocks a commit on an untracked directory (target/) that was never staged; passing explicit paths after git add s
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:49:00Z
updated: 2026-11-11T04:49:00Z
---

## Description
commit-gate commit-foreign blocks a commit on an untracked directory (target/) that was never staged; passing explicit paths after git add still blocked once

kit-bug-shape: cap:bug:commit-gate-commit-foreign-blocks-a-commit-on-an
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
BLOCKED on the KIT-T944 commit (same reason: the fix is in hooks/commit-gate.mjs). Root cause reproduced against the live gate: with an explicit pathspec the gate judges the output of git status --porcelain -- <paths>, which lists an untracked directory (?? target/) whenever the pathspec reaches it (a commit with -- . , or a stray unquoted token such as target/ in the command), and commit-foreign then blocks it as a path this session never wrote. A pathspec commit never includes an untracked file, so only tracked entries are judged. Built and tested without the gate: hooks/lib/commit-files.mjs (pathspecFiles drops ?? entries, keeps M, A and R) and hooks/commit-message-files.test.mjs (22 passed). Patch once T944 lands: import pathspecFiles from ./lib/commit-files.mjs and, in the spec.mode === 'paths' branch, set changed = pathspecFiles(git(['-C', root, 'status', '--porcelain', '--', ...spec.paths])) instead of uniq(porcelainFiles(...)). Gate-level controls to add then: a commit with -- . , an untracked target/ and a staged tracked file passes commit-foreign; a tracked foreign file inside the pathspec still blocks.

## History
- [2026-11-11 04:49] (created) bug — commit-gate commit-foreign blocks a commit on an untracked directory (target/) that was never staged; passing explicit paths after git add s
