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
- [2026-11-11 02:30] (landed) bf2989e tickets: KIT-T982, KIT-T984, KIT-T965, KIT-T966 to review with criteria ticked (implements KIT-T982)
- [2026-11-11 02:36] (comment) @claude: Cause: git restores are not a hand write by effect. Fix a19f1fa: hooks/lib/restored-content.mjs exempts a changed file w (full comment #1 in ## Notes)
### comment #1 [2026-11-11 02:36] @claude
Cause: git restores are not a hand write by effect. Fix a19f1fa: hooks/lib/restored-content.mjs exempts a changed file whose content equals HEAD (batched ls-tree + diff), and, in a call that runs git, one whose content (LF, CRLF or as-is) an Edit/Write ledger entry of any session recorded earlier (toolWriteProves with no time bound, only existing HEAD API; the KIT-T944 working-tree cleanWriters was not used). Without git in the call the T949/T953 timing rules are untouched. Tests: hooks/hand-write-restore.test.mjs (9, mutation-checked: no HEAD rule fails 2, no ledger rule fails 2); harness extracted to hooks/hand-write-harness.mjs. Supersedes KIT-T963, KIT-T977, KIT-T933.
- [2026-11-11 02:37] (landed) 579f6dd tickets: notes for KIT-T982, KIT-T984, KIT-T966 (implements KIT-T982)
- [2026-11-11 02:44] (landed) d957604 restored-content: HEAD equality by blob id (no diff inference, fail closed); ledger replay only for a confirmed entry of
- [2026-11-11 03:04] (comment) @claude: Security pass: hooks/lib/restored-content.mjs compares blob ids computed in-process (no git diff inference, git failure  (full comment #2 in ## Notes)
### comment #2 [2026-11-11 03:04] @claude
Security pass: hooks/lib/restored-content.mjs compares blob ids computed in-process (no git diff inference, git failure = not restored); the ledger replay needs a CONFIRMED entry of the calling session within 30 minutes AND a blob of those bytes in git's object store AND git in the command. Tests: hooks/hand-write-restore.test.mjs (19). Note: restored-content reads the toolwrites ledger slot directly (readTurnState) because tool-writes.mjs is held by the KIT-T944 residual; fold it into a tool-writes export once that lands.
