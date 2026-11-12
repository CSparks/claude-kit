---
id: KIT-T1097
title: commit-gate (commit-log) blocked 'git commit -q -F <scratchpad file>' in road-generator 2026-11-12 as 'code commit with no ticket citation'
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1019]
files: []
supersedes:
superseded_by:
created: 2026-11-12T16:04:24Z
updated: 2026-11-12T16:18:35Z
fixed_commit: dd88e94
---

## Description
commit-gate (commit-log) blocked 'git commit -q -F <scratchpad file>' in road-generator 2026-11-12 as 'code commit with no ticket citation' although the message file's subject ended '(implements RDG-T015)'. The gate reads only the command line, not a -F message file. The store-shell-gate had just told the session to put the text in a scratchpad file, so the two gates contradict each other. Wanted: commit-gate reads the -F file (and -t template) for the citation; a test with a cited -F file passing and an uncited one blocked.

kit-bug-shape: cap:bug:commit-gate-commit-log-blocked-git-commit-q-f-sc
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] commit-gate reads the message of git commit -F <file> (also --file, -aF, MSYS paths) for the ticket citation; a cited file passes, an uncited file, a missing file and -F - still block: commit-gate-message-file.test.mjs 10 passed, commit-message-files.test.mjs 22 passed, commit-gate.test.mjs 42 passed

## Plan
1.

## Notes
Same defect as KIT-T1019, whose libs (hooks/lib/commit-message.mjs, 22 tests) landed in a86f68c while the gate patch waited on KIT-T944; commit-gate.mjs is clean now, so the patch is applied here: cited = command plus the -F file text, used for the citation, no-log, foreign-key and commit-foreign tests. Added MSYS drive path translation in commitMessageText. A -t template is not read: git ignores a template when a message is given, and a message-less commit opens an editor. Not done: -F - (stdin) cannot be read ahead; the command text, which carries a heredoc body, is judged alone.

## History
- [2026-11-12 16:04] (created) bug — commit-gate (commit-log) blocked 'git commit -q -F <scratchpad file>' in road-generator 2026-11-12 as 'code commit with no ticket citation'
- [2026-11-12 16:18] (comment) criterion added: commit-gate reads the message of git commit -F <file> (also --file, -aF, MSYS paths) for the ticket citation; a cited file passes, an uncited file, a missing file and -F - still block: commit-gate-message-file.test.mjs 10 passed, commit-message-files.test.mjs 22 passed, commit-gate.test.mjs 42 passed
- [2026-11-12 16:18] (comment) ticked: commit-gate reads the message of git commit -F <file> (also --file, -aF, MSYS paths) for the ticket citation; a cited file passes, an uncited file, a missing file and -F - still block: commit-gate-message-file.test.mjs 10 passed, commit-message-files.test.mjs 22 passed, commit-gate.test.mjs 42 passed
- [2026-11-12 16:18] (landed) dd88e94 commit-gate: the message of git commit -F <file> counts for the ticket citation (implements KIT-T1097, KIT-T1019)
- [2026-11-12 16:18] (status) todo → review
