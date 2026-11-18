---
id: KIT-T1370
title: Process failure 2026-11-18: three sweep writers (claude-kit:implementer agents) called the Grep tool on a directory and were blocked by the
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T06:50:24Z
updated: 2026-11-18T06:54:25Z
fixed_commit: 55af2f98
---

## Description
Process failure 2026-11-18: three sweep writers (claude-kit:implementer agents) called the Grep tool on a directory and were blocked by the source-discovery gate. Root cause: the implementer agent definition lacks the 'Search - q first' rule that perf-tuner.md has (line 89: a directory or tree goes to q code, never the Grep tool), and my briefs said only 'never grep in Bash'. Prevention: put the rule into every writer agent definition and the dispatch brief checklist.

kit-bug-shape: cap:bug:process-failure-2026-11-18-three-sweep-writers-c:7d1f22df
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] every tracked agent definition carries the target-to-tool rule (already true since c16846a5) and names q code --multiline with the collect-then-iterate example in its Search section (scripts/search-adoption.test.mjs)

## Plan
1.

## Notes
Diagnosis: the premise does not hold on disk. All 15 agent definitions, agents/implementer.md included (line 70), carry the "Pick the tool by target" rule word for word as agents/perf-tuner.md line 89 (a directory, tree or glob goes to q code, q sym or q file, never the Grep tool or a shell grep; ONE named file goes to Read or Grep with that file). It landed in c16846a5 (2026-11-17 13:32 -0600), and scripts/search-adoption.test.mjs (KIT-T1348) has required it in every tracked agent since.

Cause of the three Grep calls: the sweep writers were dispatched from road-generator session 4100d9bf, which started on 2026-11-16, before c16846a5. A session reads agent definitions once at start (the plugin root is the directory marketplace D:/dev/claude-kit; see KIT-T1361), so that session still serves the older implementer text without the rule. Evidence: this very agent, a claude-kit:implementer dispatched from 4100d9bf, received a Search section with no "Pick the tool by target" line. The fix for the owner is a session restart (/exit, then `claude --continue` in D:/dev/road-generator), which also loads the newer hook wiring.

Done here: every agent's Search section now names `q code --multiline` (`-U`) for a pattern across lines, with the collect-then-iterate example (KIT-T1369); the orient cheat-sheet line names --multiline; scripts/search-adoption.test.mjs requires the multiline line in every tracked agent. Plugin 0.1.59.

Tests: search-adoption all pass (9, new multiline case included); agent-pins, plugin-compat, contract-rules, wait-poll, agent-recipes exit 0.

## History
- [2026-11-18 06:50] (created) bug — Process failure 2026-11-18: three sweep writers (claude-kit:implementer agents) called the Grep tool on a directory and were blocked by the
- [2026-11-18 06:53] (status) todo → doing
- [2026-11-18 06:54] (comment) criterion added: every tracked agent definition carries the target-to-tool rule (already true since c16846a5) and names q code --multiline with the collect-then-iterate example in its Search section (scripts/search-adoption.test.mjs)
- [2026-11-18 06:54] (comment) ticked: every tracked agent definition carries the target-to-tool rule (already true since c16846a5) and names q code --multiline with the collect-then-iterate example in its Search section (scripts/search-adoption.test.mjs)
- [2026-11-18 06:54] (landed) 55af2f98 agents: every Search section names q code --multiline for a pattern across lines, with the collect-then-iterate example;
- [2026-11-18 06:54] (status) doing → review
- [2026-11-18 06:54] (comment) runtime 55af2f98 published, plugin 0.1.59
