---
id: KIT-T449
title: q.mjs crashes with SyntaxError in scripts/question-asks.mjs:16 (/^**Resolution:**.*$/m 'Nothing to repeat') on some q code invocations, e.g.
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T19:51:14Z
updated: 2026-10-13T22:28:47Z
---

## Description
q.mjs crashes with SyntaxError in scripts/question-asks.mjs:16 (/^**Resolution:**.*$/m 'Nothing to repeat') on some q code invocations, e.g. q code '\.measure\(\)|\.origin\(|hit_test\(' --regex --lang rust --path <a single .rs file>; same command with a directory path works

kit-bug-shape: cap:bug:q-mjs-crashes-with-syntaxerror-in-scripts-questi
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 19:51] (created) bug — q.mjs crashes with SyntaxError in scripts/question-asks.mjs:16 (/^**Resolution:**.*$/m 'Nothing to repeat') on some q code invocations, e.g.
- [2026-10-13 22:28] (comment) @claude: (fixed) cb145c1. Test evidence: scripts/question-asks.test.mjs 23 passed: q code with *foo, a+?, regex metacharacters ne (full comment #1 in ## Notes)
### comment #1 [2026-10-13 22:28] @claude
(fixed) cb145c1. Test evidence: scripts/question-asks.test.mjs 23 passed: q code with *foo, a+?, regex metacharacters never crashes; root cause was a transient half-edited question-asks.mjs, never committed; npm test green
- [2026-10-13 22:28] (status) todo → review
