---
id: KIT-T1174
title: commit gate miss: hooks/commit-gate.mjs:31 isCommit does not match git -C with a QUOTED path containing a space followed by commit, so the g
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-14T01:10:53Z
updated: 2026-11-14T01:46:45Z
---

## Description
commit gate miss: hooks/commit-gate.mjs:31 isCommit does not match git -C with a QUOTED path containing a space followed by commit, so the gate exits 0 and judges nothing (no ticket citation check, no commit-foreign check, no message-file check) for such a commit; the maintainer's home directory has a space. Found by a kit agent reading the code, 2026-11-14; not reproduced in a live session. Fix: parse the git call with the shared git subcommand parser (global options, quoted values) so every form of a commit is recognised; negative control: a non-commit call with a quoted -C path is not judged as a commit.

kit-bug-shape: cap:bug:commit-gate-miss-hooks-commit-gate-mjs-31-iscomm:f9d0b076
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] git -C with a quoted path holding a space and every other global-option spelling of a commit reaches the commit gate

## Plan
1.

## Notes
Cause: commit-gate.mjs isCommit, commitSpec and targetDir, commit-message.mjs COMMIT and commit-stamp.mjs COMMIT_CMD each matched the raw command text with a regex that fails on a quoted -C value holding a space. Fix 3e553e4: hooks/lib/git-calls.mjs parses the call through the shared walker (lead-command-walk, git-subcommand gitCommand) into sub, args, options and dir; commit-gate, commit-message, commit-stamp, upstream-policy, branch-guard and worktree-guard use it. A line whose quoting is ambiguous that the old pattern reads as a commit is still judged. Walker fixes: withoutRedirects keeps a quoted > and cleaned keeps the dollar of a variable. Evidence: hooks/commit-gate-git-call.test.mjs 29 passed (repro failed 16 of 29 before the fix), upstream-gate 44, commit-stamp 13, branch-guard 47, worktree-guard all, lead-command-walk 11, commit-gate 42, commit-gate-message-file 20; walker suites patch-apply 77, shell-write-scan 54, source-shell-gate family 264+134+238+62+13+168+11+113+17, store-shell-gate 66, shell-copy-target 76+58, shell-variables-allowlist 192, shell-rebinder-qualifiers 23 all green. Runtime published 3135916. Left: cmd /c wrappers are not runner-known (runner-texts.mjs), legacy-shell GIT_FROM regex stops a quoted -C value at a closing paren.

## History
- [2026-11-14 01:10] (created) bug — commit gate miss: hooks/commit-gate.mjs:31 isCommit does not match git -C with a QUOTED path containing a space followed by commit, so the g
- [2026-11-14 01:45] (landed) 3e553e4 git-calls: a git commit is recognised by parsing the call, not by a regex on the text, so git -C "<dir with a space>" co
- [2026-11-14 01:46] (comment) criterion added: git -C with a quoted path holding a space and every other global-option spelling of a commit reaches the commit gate
- [2026-11-14 01:46] (comment) ticked: git -C with a quoted path holding a space and every other global-option spelling of a commit reaches the commit gate
- [2026-11-14 01:46] (status) todo → review
