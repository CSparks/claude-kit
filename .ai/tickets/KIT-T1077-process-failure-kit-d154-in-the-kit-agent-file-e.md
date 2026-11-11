---
id: KIT-T1077
title: process failure (KIT-D154) in the kit agent: file edits and script writes attempted through sed -i and a cat heredoc in Bash, blocked by sto
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T19:44:36Z
updated: 2026-11-11T19:44:36Z
---

## Description
process failure (KIT-D154) in the kit agent: file edits and script writes attempted through sed -i and a cat heredoc in Bash, blocked by store-shell-gate and source-shell-gate; root cause: reaching for shell edits mid-probe instead of the Edit and Write tools; prevention: every scratchpad script and edit goes through Write or Edit first, the brief already says so

kit-bug-shape: cap:bug:process-failure-kit-d154-in-the-kit-agent-file-e
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 19:44] (created) bug — process failure (KIT-D154) in the kit agent: file edits and script writes attempted through sed -i and a cat heredoc in Bash, blocked by sto
