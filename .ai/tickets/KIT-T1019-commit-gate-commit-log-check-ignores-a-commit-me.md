---
id: KIT-T1019
title: commit-gate commit-log check ignores a commit message passed with git commit -F <file> and blocks a message that cites its ticket
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T364
superseded_by:
created: 2026-11-11T04:48:59Z
updated: 2026-11-11T04:48:59Z
---

## Description
commit-gate commit-log check ignores a commit message passed with git commit -F <file> and blocks a message that cites its ticket

kit-bug-shape: cap:bug:commit-gate-commit-log-check-ignores-a-commit-me
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
BLOCKED on the KIT-T944 commit: the fix lives in hooks/commit-gate.mjs, which carries T944's uncommitted import of hooks/lib/live-claims.mjs, so it cannot be edited or committed here. Built and tested without it: hooks/lib/commit-message.mjs (commitMessageFile and commitMessageText read -F <file>, -F<file>, -aF <file>, --file <file>, --file=<file>; stdin '-' reads as empty and the command text, which carries a heredoc body, is judged alone) and hooks/commit-message-files.test.mjs (22 passed). Repro against the live gate: a commit with -F msg.txt, where 'implements KIT-T1' is only in msg.txt, exits 2 (staged, paths and --file= shapes alike). Patch for hooks/commit-gate.mjs once T944 lands: (1) import commitMessageText from ./lib/commit-message.mjs; (2) after the line that sets root, add: const cited = command plus a newline plus commitMessageText(command, targetDir(command)); (3) use cited instead of command in the three citation tests, the [no-log test and foreignCiteProblem(root, changed, cited) near the foreign-cite check, and the final ID_CITE_SRC / [no-log test. Gate-level controls to add then: a message file citing the ticket passes; a message file with no cite still blocks; -F - with no cite in the command text still blocks. KIT-T364 is superseded by this ticket.

## History
- [2026-11-11 04:48] (created) bug — commit-gate commit-log check ignores a commit message passed with git commit -F <file> and blocks a message that cites its ticket
- [2026-11-11 04:53] (landed) a86f68c commit-message and commit-files libs for the commit-gate -F and pathspec fixes, tests with negative controls; KIT-T364 s
