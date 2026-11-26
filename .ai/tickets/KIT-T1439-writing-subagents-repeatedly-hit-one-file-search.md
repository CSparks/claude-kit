---
id: KIT-T1439
title: Writing subagents repeatedly hit one-file-search (grep/awk on a named log or source file) and source-shell-write (sed write, git stash pop)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-20T06:05:34Z
updated: 2026-11-20T06:26:30Z
---

## Description
Writing subagents repeatedly hit one-file-search (grep/awk on a named log or source file) and source-shell-write (sed write, git stash pop) gates in road-generator RDG-T131 P1, P2a, P2b despite a brief that says search with q and never grep; the gate text or the agent definitions should teach the Grep/Read/Edit alternative at the block, and the brief template should carry it

kit-bug-shape: cap:bug:writing-subagents-repeatedly-hit-one-file-search:d403d4c5
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: the RDG-T131 writers (P1, P2a, P2b, P2c) were dispatched as general-purpose (road-generator .ai/agents.jsonl scope field), so the KIT-T1348 map in the kit agent definitions never reached them; a kit implementer (this fix agent) also hit one-file-search and a source discovery block while reading it, so definition prose alone does not hold. Fix: SubagentStart hook subagent-gate-guide (additionalContext reaches every subagent of an adopted repo whatever its type; event and field verified in the claude binary schema), one-file-search block leads with the exact Grep and Read calls (and the awk/sed pattern), source-shell-write block leads with the Edit or Write call for the named file and a stash refusal prints the baseline route (stash only files you wrote, git show HEAD:<path>, committed numbers, coordinator), q gates source carries the route, plugin 0.1.62. Tests: hooks/agent-gate-guide.test.mjs 15 passed; query-gate-one-file 59, query-gate-build-log 5, query-gate-finished-log 8, query-gate 32s all pass, git-search 49, gate-protocol 57, git-integration-guard 18 ok 0 FAIL, source-shell-gate 168, source-shell-gate-delete 63, search-adoption 9, plugin-drift 14, contract-rules 48. gate-digest.test 'within 15 lines' fails at 17 lines: pre-existing, from the dispatch-difficulty token rows, untouched by this change.
Recurrence 2026-11-26 (fix agent for KIT-T1594, fleet-desktop dispatch): a shell grep -E on a named test log (target/t1594-before.txt) chained after the test run; one-file-search refused the whole chain, so the test never ran. Root cause: the agent reached for grep to filter a saved log instead of filtering the command's own output inline or using the Grep tool. Prevention idea: the implementation-agent brief's 'Waiting on builds' section could show the inline-pipe form beside the redirect form, so the one-file search never arises.

## History
- [2026-11-20 06:05] (created) bug — Writing subagents repeatedly hit one-file-search (grep/awk on a named log or source file) and source-shell-write (sed write, git stash pop)
- [2026-11-20 06:26] (landed) 88610540 subagents learn the allowed tool before and at the gate block: SubagentStart guide, Grep/Read/Edit/baseline lines in the
- [2026-11-20 06:26] (status) todo → review
