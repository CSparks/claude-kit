---
id: KIT-T1069
title: query-gate gap: git grep with directory pathspecs after -- passes as targeted because one file operand (CMakeLists.txt) counts as targets-on
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T18:16:00Z
updated: 2026-11-11T19:05:59Z
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
RESIDUAL (found after publish, live in runtime 01179ca, NOT fixed): searchPaths in hooks/lib/search-targets.mjs knows only exact separate value flags, so a bundled short flag whose last letter takes a value makes the value the pattern and the real pattern a path: BLOCK for rg -nA 3 foo crates/x/src/lib.rs, grep -rnC 2 foo src/a.cpp and rg --max-columns 200 foo crates/x/src/lib.rs (all passed before 9c9a60a). Unbundled forms (-n -A 3, -C3, -m 5) pass. The Grep tool is unaffected: grep-tool-command.mjs emits no -A/-B/-C. Fix: recognise a bundle ending in a value-taking letter (A B C m g t T j d O) and the long value flags (--max-columns, --max-filesize, --colors ...), or judge an operand that is an existing directory or a glob instead of every non-pattern operand being a file. Left unfixed because another writer started editing this checkout mid-run (stop rule).

## History
- [2026-11-11 18:16] (created) bug — query-gate gap: git grep with directory pathspecs after -- passes as targeted because one file operand (CMakeLists.txt) counts as targets-on
- [2026-11-11 18:23] (comment) @claude: Evidence: query-gate passes git grep -n ModalOverlay -- src tests CMakeLists.txt (one file operand makes targetsOneFile  (full comment #1 in ## Notes)
### comment #1 [2026-11-11 18:23] @claude
Evidence: query-gate passes git grep -n ModalOverlay -- src tests CMakeLists.txt (one file operand makes targetsOneFile true), git -C dir grep, git --no-pager grep; git grep -n ModalOverlay | head blocks. Cause: hooks/query-gate.mjs targetsOneFile uses args.some(FILEISH) and gitGrep reads tok[1] only.
- [2026-11-11 18:36] (landed) 9c9a60a query-gate: a git grep is read past git's global options (-C dir, -c k=v, --no-pager), and a search is targeted only whe
- [2026-11-11 18:59] (status) todo → review
- [2026-11-11 19:00] (landed) 31b568a tickets: KIT-T1068, T1069, T1071 fixed and in review with notes and Handoff, KIT-T1012 confirmed fixed (implements KIT-T
- [2026-11-11 19:05] (status) review → todo
- [2026-11-11 19:05] (comment) remaining after 2 landed commit(s): bundled short flags with a value (rg -nA 3, grep -rnC 2) and --max-columns block one-file greps: regression in hooks/lib/search-targets.mjs
