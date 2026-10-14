---
id: KIT-T465
title: t comment ignores --file: the comment body became the literal file path (DE-T131 comment #19, 2026-10-13); --file should read the file as th
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T02:52:21Z
updated: 2026-10-14T03:28:31Z
fixed_commit: 16140a3
---

## Description
t comment ignores --file: the comment body became the literal file path (DE-T131 comment #19, 2026-10-13); --file should read the file as the body or be rejected

kit-bug-shape: cap:bug:t-comment-ignores-file-the-comment-body-became-t
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 02:52] (created) bug — t comment ignores --file: the comment body became the literal file path (DE-T131 comment #19, 2026-10-13); --file should read the file as th
- [2026-10-14 02:52] (comment) seen again in dirt-empire: t comment ignores --file: the comment body became the literal file path (DE-T131 comment 19, 2026-10-13); --file should read the file as the body or be rejected
- [2026-10-14 02:52] (asked again) 2026-10-14 — cap:bug:t-comment-ignores-file-the-comment-body-became-t
- [2026-10-14 03:28] (comment) @claude: Fixed 16140a3; test: scripts/comments.test.mjs (36 passed, incl. comment --file); full npm test green.
- [2026-10-14 03:28] (status) todo → review
- [2026-10-14 03:28] (comment) test: scripts/comments.test.mjs 36 passed
- [2026-10-14 03:29] (comment) @claude: Same root cause, second symptom (stiletto 2026-10-13): 't comment ST-T902 "..." --agent claude' silently ignored the unk (full comment #2 in ## Notes)
### comment #2 [2026-10-14 03:29] @claude
Same root cause, second symptom (stiletto 2026-10-13): 't comment ST-T902 "..." --agent claude' silently ignored the unknown --agent flag and stamped the comment 'by @chris'. That puts words in the maintainer's mouth in an append-only log (ST-T902#1). Fix the class: t comment should reject unknown flags with a usage error rather than ignoring them, and with no --author it should default to the agent in an agent context, not to chris.
- [2026-10-14 03:52] (comment) @claude: Second symptom fixed in this commit; tests: scripts/comments.test.mjs (41 passed: --agent rejected, made-up flag rejected, tick rejects unknown flag, CLAUDECODE=1 -> @claude, unset -> resolved user).
