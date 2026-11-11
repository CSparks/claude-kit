---
id: KIT-T1029
title: Orchestrator idles while blocked on AskUserQuestion: dirt-empire 2026-11-11, a questionnaire sent ~03:50Z blocked the main thread until the
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:33:10Z
updated: 2026-11-11T06:33:10Z
---

## Description
Orchestrator idles while blocked on AskUserQuestion: dirt-empire 2026-11-11, a questionnaire sent ~03:50Z blocked the main thread until the maintainer answered ~06:20Z; meanwhile worker jobs finished (L5e passed 03:50, jump diag 03:40) and nobody resumed the paused workers, so 2.5 h of a max-throughput bill was lost. Needed: the question gate (or a PreToolUse hook on AskUserQuestion) warns when finished.log holds results newer than the last resume of their agents, so the orchestrator resumes workers first; and/or workers get a self-resume path that does not need the main thread.

kit-bug-shape: cap:feature:orchestrator-idles-while-blocked-on-askuserquest
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:33] (created) feature — Orchestrator idles while blocked on AskUserQuestion: dirt-empire 2026-11-11, a questionnaire sent ~03:50Z blocked the main thread until the
