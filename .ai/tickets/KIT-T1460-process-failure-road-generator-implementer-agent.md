---
id: KIT-T1460
title: process failure (road-generator, implementer agent a9ac8af0ce22e4a68, 2026-11-21): claude-kit:implementer hit five gate blocks in one build
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-21T07:14:01Z
updated: 2026-11-21T07:15:28Z
---

## Description
process failure (road-generator, implementer agent a9ac8af0ce22e4a68, 2026-11-21): claude-kit:implementer hit five gate blocks in one build run: three Bash greps of one named file, one tree-wide Grep, one Bash call over 300 s with a loop. Same family perf-tuner, analyst, analyst-max and researcher got rules for. Root cause: implementer.md lacks the no-grep-of-named-files, q-for-tree-search and no-polled-loop rules. Prevention: add them to agents/implementer.md (and patch-worker, refactorer, test-author if they lack them).

kit-bug-shape: cap:bug:process-failure-road-generator-implementer-agent:f860a444
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] implementer and the named writer definitions carry the named-file, tree-search and no-polled-loop rules (verified present at 1b999444; search-adoption 9 passed, agent-recipes all ok)

## Plan
1.

## Notes
Checked at HEAD 1b999444: no definition gap. agents/implementer.md and all 14 other agent definitions already carry the three rules: 'Pick the tool by target' (a named file: Read or the Grep tool on that one file, never a shell grep; a tree: q), and the wait rule with KIT-D115 / never sleep-loop / one foreground call under 170 s (docs/wait-rule.md, included verbatim). Pick-the-tool landed in 88610540 (2026-11-20 00:26) and 55af2f98; installed plugin 0.1.66 (updated 2026-11-21 01:14Z) carries them too. Existing tests already assert both for every definition: scripts/search-adoption.test.mjs (9 passed, KIT-T1348, every tracked agent) and hooks/agent-recipes.test.mjs (every agent carries the wait rule verbatim; all ok). No file changed, no new test needed. The five blocks therefore came from an agent that did not follow its definition, or from a session that loaded a pre-0.1.66 definition; not determinable from the store. Open for the coordinator: check which plugin version agent a9ac8af0ce22e4a68 loaded.

## History
- [2026-11-21 07:14] (created) bug — process failure (road-generator, implementer agent a9ac8af0ce22e4a68, 2026-11-21): claude-kit:implementer hit five gate blocks in one build
- [2026-11-21 07:15] (comment) criterion added: implementer and the named writer definitions carry the named-file, tree-search and no-polled-loop rules (verified present at 1b999444; search-adoption 9 passed, agent-recipes all ok)
- [2026-11-21 07:15] (comment) ticked: implementer and the named writer definitions carry the named-file, tree-search and no-polled-loop rules (verified present at 1b999444; search-adoption 9 passed, agent-recipes all ok)
- [2026-11-21 07:15] (status) todo → review
