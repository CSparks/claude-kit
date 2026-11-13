---
id: KIT-T1157
title: source-discovery gate blocks rg on a shell variable path (rg PATTERN $S where S is a scratchpad test log, not the source tree); it cannot re
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T21:04:25Z
updated: 2026-11-13T22:57:28Z
---

## Description
source-discovery gate blocks rg on a shell variable path (rg PATTERN $S where S is a scratchpad test log, not the source tree); it cannot resolve the variable and treats it as a tree-wide grep. Should resolve simple assignments in the same command or allow scratchpad paths

kit-bug-shape: cap:bug:source-discovery-gate-blocks-rg-on-a-shell-varia:b2a46ecf
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A search whose target is a shell variable the command assigns as one literal, and whose every target is an absolute file outside every adopted repo, passes the retrieval gate; an unresolvable variable stays blocked and the block names it; a directory, a repo path and a path beside a repo directory stay blocked (hooks/query-gate-variables.test.mjs: 10 of 19 failed before, 19 passed after; fdb3e8e)

## Plan
1.

## Notes
Cause: the failing command was S=/c/Users/CHRISS~1/.../scratchpad/joins.txt; JOINS_DEBUG=1 cargo test ... > S 2>&1; rg PATTERN S, with S written as a dollar variable (transcript agent-a349707aac870a285, 21:04). The gate judged the segment text as written: the variable is no concrete file (no extension), so a recursive rg was source discovery. Fix fdb3e8e: hooks/lib/search-outside.mjs resolves each segment with precedingValues and expandVariables before judging, and a search whose every target is an absolute path outside the repo and outside any adopted repo (lands-outside-repo.mjs; a directory is never proof; 8.3 short names resolve through realpath) is no source-tree search. An unresolved variable stays blocked and the block adds: the variable could not be resolved, assign it as one literal earlier in the same command. Side effect, a tightening: a variable holding a store or source path is now judged by its value (D=.ai/tickets; grep -r x on D blocks). The brief second item, an rg on a source file the gate did not catch: no such command is in the ticket text or in the reporting agent transcript; a replay of every rg and grep that agent ran shows only the one variable block, and its rg calls of named source files (rg -n pattern src/joins.rs tests/joins.rs) pass by the gate documented rule (a targeted grep of named files). Tests run: query-gate-variables 19 passed (10 failed before); query-gate 140; query-gate-pipes 51; scratch-only 13; index-redirect 44; git-search 49.
Follow-up 02fca72 and 66e27a6 (coordinator review: the lenient resolver let a conditional or later assignment make a tree search look like an outside-file search): the gate now resolves variables with the strict assignedValues (an unconditional bare assignment earlier in the same shell; an assignment in an && chain is visible only to segments joined by && alone). Blocked and tested: conditional assignment (false && P=x; rg y P), assignment after the search, prefix assignment (P=x rg y P), subshell assignment, cd-prefix then a semicolon, variable set empty, unset variable, computed variable. Passes: unconditional earlier assignment to an outside file, also cd dir && S=x && rg. Consequence: the original shape cd dir && S=x; cmd; rg y S stays blocked, so the agent writes S=x first (S=x; cd dir && ...) or chains with &&; the block text says so. Also closed: a search behind a prefix assignment (FOO=1 rg fn crates/) or env was not recognised as a search and passed; it is judged as the search it is. query-gate-variables 31 passed.

## History
- [2026-11-13 21:04] (created) bug — source-discovery gate blocks rg on a shell variable path (rg PATTERN $S where S is a scratchpad test log, not the source tree); it cannot re
- [2026-11-13 22:55] (landed) fdb3e8e query-gate: a variable the command assigns as one literal earlier is resolved before the search is judged (precedingValu
- [2026-11-13 22:57] (comment) criterion added: A search whose target is a shell variable the command assigns as one literal, and whose every target is an absolute file outside every adopted repo, passes the retrieval gate; an unresolvable variable stays blocked and the block names it; a directory, a repo path and a path beside a repo directory stay blocked (hooks/query-gate-variables.test.mjs: 10 of 19 failed before, 19 passed after; fdb3e8e)
- [2026-11-13 22:57] (comment) ticked: A search whose target is a shell variable the command assigns as one literal, and whose every target is an absolute file outside every adopted repo, passes the retrieval gate; an unresolvable variable stays blocked and the block names it; a directory, a repo path and a path beside a repo directory stay blocked (hooks/query-gate-variables.test.mjs: 10 of 19 failed before, 19 passed after; fdb3e8e)
- [2026-11-13 22:57] (comment) @claude: (fixed) fdb3e8e; query-gate-variables.test.mjs 19 passed (10 failed before)
- [2026-11-13 22:57] (status) todo → review
- [2026-11-13 23:18] (landed) 66e27a6 shell-variables: an assignment behind cd dir && (any && chain) is visible to the segments joined to it by && alone, and 
