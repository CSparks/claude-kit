---
id: KIT-T942
title: Process failure 2026-11-10 (stiletto-2349): orchestrator ran grep over the claude-kit .ai/inbox to look for a duplicate ticket and the store
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:13:15Z
updated: 2026-11-10T17:13:15Z
---

## Description
Process failure 2026-11-10 (stiletto-2349): orchestrator ran grep over the claude-kit .ai/inbox to look for a duplicate ticket and the store-grep gate (KIT-T236) blocked it; q fts/q inbox were the right tools. Prevention: the dedup-before-file step (q fts on nouns) is the only sanctioned duplicate check, and a 'verify nobody is already on it' check runs q fts + q doc-trail + q recent, never grep.

kit-bug-shape: cap:bug:process-failure-2026-11-10-stiletto-2349-orchest
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 17:13] (created) bug — Process failure 2026-11-10 (stiletto-2349): orchestrator ran grep over the claude-kit .ai/inbox to look for a duplicate ticket and the store
