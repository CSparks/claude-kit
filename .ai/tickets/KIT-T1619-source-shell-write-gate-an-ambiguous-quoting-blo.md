---
id: KIT-T1619
title: source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shel
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T23:18:11Z
updated: 2026-11-27T23:18:11Z
---

## Description
source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shell-source-write.mjs passes an ambiguous() builder that drops the ambiguity and trigger scanAllShellWrites hands it; the query gate and store gate print them. Without them a blocked agent cannot tell which construct (a backtick span inside double quotes, a backslash before a quote) or which write word fired, and captures misname the cause (KIT-T1618 blamed braces and an asterisk). Fix: keep reason, at, span and trigger on the hit and print them in source-shell-gate.mjs.

kit-bug-shape: cap:bug:source-shell-write-gate-an-ambiguous-quoting-blo:c5f31c41
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-27 23:18] (created) bug — source-shell-write gate: an ambiguous-quoting block prints only the generic message, no reason, span or trigger word, because hooks/lib/shel
