---
id: KIT-T1163
title: source-shell-gate: git clean -f -- <untracked path>, git rm -f and git stash push -u pass every kit gate, so they delete an untracked file a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T22:57:48Z
updated: 2026-11-14T00:10:13Z
---

## Description
source-shell-gate: git clean -f -- <untracked path>, git rm -f and git stash push -u pass every kit gate, so they delete an untracked file another agent wrote; the rm refusal of another writer file (KIT-T1156) has an end-around through git verbs the gate treats as inert

kit-bug-shape: cap:bug:source-shell-gate-git-clean-f-untracked-path-git:2270bb2e
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] git clean, git rm -f and git stash -u are judged like rm: a named file only when the caller wrote it (ledger), a sweep (no path, directory, glob, unresolved variable, pathspec file, unresolved alias or unknown subcommand) refused while another writer is live, controls for plain git rm, dry runs, git stash, everyday built-ins; hooks/source-shell-gate-discard.test.mjs 156 passed, 14 failed before (95dc46b, f2bad4d, 4ac8290)

## Plan
1.

## Notes
Fixed 95dc46b, f2bad4d, 4ac8290. hooks/source-shell-gate-discard.test.mjs 156 passed (35, 11, 14 failed before). Not judged, out of scope: checkout of a path, restore and reset --hard (discard tracked changes), plain stash (hides them), a program git-x on PATH that git lists.
Allow-list round 8fc9c9a: git-call-policy.mjs replaces the deny-list and git-alias.mjs; hooks/source-shell-gate-discard.test.mjs 264 passed (49 failed before); patch-apply.test 77 passed (the two checkout and restore of a path cases moved from passes to blocks: they are discards now). Runtime published at 8fc9c9a.

## History
- [2026-11-13 22:57] (created) bug — source-shell-gate: git clean -f -- <untracked path>, git rm -f and git stash push -u pass every kit gate, so they delete an untracked file a
- [2026-11-13 23:46] (landed) 95dc46b source-shell-gate: a delete operand a variable supplies is judged by the literal the command assigns it or refused, and
- [2026-11-13 23:59] (landed) f2bad4d source-shell-gate: close four bypasses of the delete judgement: --pathspec-from-file and --pathspec-file-nul make a git
- [2026-11-14 00:09] (landed) 4ac8290 git-alias, git-subcommand: alias resolution fails closed: a subcommand that is no built-in, no alias and not listed by g
- [2026-11-14 00:09] (comment) criterion added: git clean, git rm -f and git stash -u are judged like rm: a named file only when the caller wrote it (ledger), a sweep (no path, directory, glob, unresolved variable, pathspec file, unresolved alias or unknown subcommand) refused while another writer is live, controls for plain git rm, dry runs, git stash, everyday built-ins; hooks/source-shell-gate-discard.test.mjs 156 passed, 14 failed before (95dc46b, f2bad4d, 4ac8290)
- [2026-11-14 00:09] (comment) ticked: git clean, git rm -f and git stash -u are judged like rm: a named file only when the caller wrote it (ledger), a sweep (no path, directory, glob, unresolved variable, pathspec file, unresolved alias or unknown subcommand) refused while another writer is live, controls for plain git rm, dry runs, git stash, everyday built-ins; hooks/source-shell-gate-discard.test.mjs 156 passed, 14 failed before (95dc46b, f2bad4d, 4ac8290)
- [2026-11-14 00:10] (status) todo → review
- [2026-11-14 00:10] (landed) 95313b6 tickets: KIT-T1162, KIT-T1163, KIT-T1167 and KIT-T1169 to review with fix shas 95dc46b, f2bad4d, 4ac8290, 9b0bd9c and bb
- [2026-11-14 00:31] (landed) 8fc9c9a source-shell-gate: a git call is judged precisely only on an ALLOW-LIST (git-call-policy.mjs): a built-in subcommand, gl
