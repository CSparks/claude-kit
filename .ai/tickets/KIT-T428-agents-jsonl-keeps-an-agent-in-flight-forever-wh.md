---
id: KIT-T428
title: agents.jsonl keeps an agent 'in-flight' forever when it dies from a usage-limit 429 (SubagentStop never fires): dirt-empire a326e808 showed
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T18:53:19Z
updated: 2026-10-12T18:53:19Z
---

## Description
agents.jsonl keeps an agent 'in-flight' forever when it dies from a usage-limit 429 (SubagentStop never fires): dirt-empire a326e808 showed in-flight 34h after the weekly limit killed it, and looked like a stalled live agent to Chris. Orient should reconcile: if the agent's task output ends in a rate-limit/usage error or its task is no longer running, mark it 'killed: usage-limit' and list its uncommitted WIP; deck: a limit hit should also auto-stash/record WIP on the ticket.

kit-bug-shape: cap:bug:agents-jsonl-keeps-an-agent-in-flight-forever-wh
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 18:53] (created) bug — agents.jsonl keeps an agent 'in-flight' forever when it dies from a usage-limit 429 (SubagentStop never fires): dirt-empire a326e808 showed
