---
id: KIT-T1069
title: query-gate gap: git grep with directory pathspecs after -- passes as targeted because one file operand (CMakeLists.txt) counts as targets-on
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T18:16:00Z
updated: 2026-11-11T18:59:47Z
---

## Description
query-gate gap: git grep with directory pathspecs after -- passes as targeted because one file operand (CMakeLists.txt) counts as targets-one-file, and git global options before grep (git -C <dir> grep, git --no-pager grep, git -c k=v grep) are not read as git grep at all. Seen: git grep -n ModalOverlay -- src tests CMakeLists.txt piped to grep -v and head, groovegrid main thread 2026-11-11 (session da28715f). Fix: pathspecs after -- must all be files to count as targeted; one shared helper finds the git subcommand past its global options for query-gate, index-answerable and search-shape

kit-bug-shape: cap:bug:query-gate-gap-git-grep-with-directory-pathspecs
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed 9c9a60a, live in runtime 01179ca. Cause: query-gate read the git subcommand as the first word after git and counted a search as targeted when ANY operand looked like a file. Fix: hooks/lib/git-subcommand.mjs gitCommand() finds the subcommand past -C dir, -c k=v, --no-pager, --git-dir and friends (shared by query-gate, index-answerable, search-shape); hooks/lib/search-targets.mjs searchPaths()/targetsOnlyFiles() make a search targeted only when every path operand is a concrete file, pattern and flag values dropped, git pathspecs read after --. A non-git grep -r over a directory plus one file is now judged the same way. Evidence: probes before (all passed the gate) and after (block) for git grep -n X -- src tests CMakeLists.txt | grep -v | head, git -C dir grep, git --no-pager grep, git -c k=v grep, quoted -C dir with spaces; controls still pass: git grep -- one file, git grep -- glob (KIT-T085 policy), git log --grep, git log | grep, rg with valued flags and one file. Tests: git-search 37, query-gate 127, index-redirect 44, search-telemetry 22, search-adoption 7, block-triage 13.

## History
- [2026-11-11 18:16] (created) bug — query-gate gap: git grep with directory pathspecs after -- passes as targeted because one file operand (CMakeLists.txt) counts as targets-on
- [2026-11-11 18:23] (comment) @claude: Evidence: query-gate passes git grep -n ModalOverlay -- src tests CMakeLists.txt (one file operand makes targetsOneFile  (full comment #1 in ## Notes)
### comment #1 [2026-11-11 18:23] @claude
Evidence: query-gate passes git grep -n ModalOverlay -- src tests CMakeLists.txt (one file operand makes targetsOneFile true), git -C dir grep, git --no-pager grep; git grep -n ModalOverlay | head blocks. Cause: hooks/query-gate.mjs targetsOneFile uses args.some(FILEISH) and gitGrep reads tok[1] only.
- [2026-11-11 18:36] (landed) 9c9a60a query-gate: a git grep is read past git's global options (-C dir, -c k=v, --no-pager), and a search is targeted only whe
- [2026-11-11 18:59] (status) todo → review
