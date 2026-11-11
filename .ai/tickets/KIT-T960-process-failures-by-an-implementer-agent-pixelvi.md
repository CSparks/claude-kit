---
id: KIT-T960
title: Process failures by an implementer agent (pixelvision landing 2, 2026-11-10): two shell writes of source files (heredoc and sed), one source
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:27:36Z
updated: 2026-11-10T18:27:36Z
---

## Description
Process failures by an implementer agent (pixelvision landing 2, 2026-11-10): two shell writes of source files (heredoc and sed), one source grep via Bash, one build over the 5 minute ceiling. Root cause: the implementer agent definition does not state: source goes through Write or Edit only, search through q with an absolute --path for Kotlin, builds under 290s per call with JAVA_HOME set. Prevention: add those lines to agents/implementer.md (context-loading update, KIT-D156). Also feature: no t verb stamps a fixed sha History line or fixed_commit frontmatter.

kit-bug-shape: cap:bug:process-failures-by-an-implementer-agent-pixelvi
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:27] (created) bug — Process failures by an implementer agent (pixelvision landing 2, 2026-11-10): two shell writes of source files (heredoc and sed), one source
