---
id: KIT-T982
title: hand-write-detect flags files restored by git stash pop as shell-written source (false positive, KIT-T706): after 'git stash push -- src/' t
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T977
superseded_by:
created: 2026-11-10T23:24:40Z
updated: 2026-11-11T02:29:38Z
fixed_commit: a19f1fa
---

## Description
hand-write-detect flags files restored by git stash pop as shell-written source (false positive, KIT-T706): after 'git stash push -- src/' then 'git stash pop' the detector lists every restored file and refuses the commit until each is re-saved via Edit/Write, though git restore is routine (KIT-D140) and the content was written through Edit earlier

kit-bug-shape: cap:bug:hand-write-detect-flags-files-restored-by-git-st
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A source file git put back (content equal to HEAD, or an earlier Edit/Write's content in a call that runs git, in any line-ending form) is no hand write, in a pure git command and in a mixed one
- [x] A shell rewrite to new content, content copied from another file, or popped content no Edit/Write ever left is still a hand write

## Plan
1.

## History
- [2026-11-10 23:24] (created) bug — hand-write-detect flags files restored by git stash pop as shell-written source (false positive, KIT-T706): after 'git stash push -- src/' t
- [2026-11-11 02:21] (comment) criterion added: A source file git put back (content equal to HEAD, or an earlier Edit/Write's content in a call that runs git, in any line-ending form) is no hand write, in a pure git command and in a mixed one
- [2026-11-11 02:21] (comment) criterion added: A shell rewrite to new content, content copied from another file, or popped content no Edit/Write ever left is still a hand write
- [2026-11-11 02:22] (landed) a19f1fa hand-write-detect: a file git put back is no hand write (content equal to HEAD, or an earlier Edit's content in a call t
- [2026-11-11 02:29] (status) todo → review
- [2026-11-11 02:29] (comment) Fixed in a19f1fa (+7c947bb test fix); runtime publish refused: exported HEAD red on hooks/claim-release-controls.test.mjs (imports uncommitted hooks/lib/live-claims.mjs, KIT-T944 residual awaiting maintainer approval), so current has not moved
- [2026-11-11 02:29] (comment) ticked: A source file git put back (content equal to HEAD, or an earlier Edit/Write's content in a call that runs git, in any line-ending form) is no hand write, in a pure git command and in a mixed one
- [2026-11-11 02:29] (comment) ticked: A shell rewrite to new content, content copied from another file, or popped content no Edit/Write ever left is still a hand write
