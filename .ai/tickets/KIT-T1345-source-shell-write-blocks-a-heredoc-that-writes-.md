---
id: KIT-T1345
title: source-shell-write blocks a heredoc that writes a scratch .py under target/perf/aa-captures/ (gitignored, not repo source) for a subagent th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T16:15:14Z
updated: 2026-11-17T16:29:23Z
---

## Description
source-shell-write blocks a heredoc that writes a scratch .py under target/perf/aa-captures/ (gitignored, not repo source) for a subagent that has no Write tool; the same heredoc pattern (collect.py, crops.py, diffs.py, compare.py) passed earlier in the same session, so the gate is inconsistent or newly tightened. Gate text tells the agent to use Write, which visual-reviewer does not have.

kit-bug-shape: cap:bug:source-shell-write-blocks-a-heredoc-that-writes-:6e413a2b
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A heredoc writing a source-extension file into a gitignored scratch folder under target/ passes however the command names the folder (literal, cd, mkdir -p then cd, assigned variable); the same shapes aimed at tracked source, an unassigned or reassigned variable and a missing cd target still block

## Plan
1.

## Notes
Reproduced against hooks/source-shell-gate.mjs (scratch repo, .gitignore target/). The gate's design: a write below a gitignored path is build output, not a hand write (build-output.mjs), and a literal path with a target/ segment is never a hit (source-path.mjs). It blocked three shapes that name the same folder indirectly, which is why identical-looking heredocs passed and blocked in one session: (1) a path through a variable the command assigns (D=target/perf/aa-captures; cat > $D/find_apex.py) was judged as the literal text $D/... under the repo root; (2) mkdir -p <folder> && cd <folder> && cat > find_apex.py: commandCwd followed a cd only into a folder that already existed when the gate ran, so the file resolved against the repo root; (3) PowerShell Set-Location is not followed (cdTarget is bash cd only; not changed here). Not caused by KIT-T1337/T1340/T1342: git log of the gate files shows no verdict change on these shapes. Fix: hooks/lib/hit-path-variables.mjs (expand a hit path with assignedValues, then skip when the resolved path is a build or temp path), hooks/lib/shell-cwd.mjs (a cd into a folder an earlier mkdir of the same command makes). Tests: hooks/source-shell-gate-scratch.test.mjs (22: 11 pass, 11 block incl. tracked crates/x/src/lib.rs, unassigned and reassigned variables, missing cd target, non-ignored mkdir folder, command that edits .gitignore); source-shell-gate 168, touch 52, touch-cd 32, touch-segments 29, variable-leader 14, chained 16, copy-variable 17, incomplete 9, delete 63, query-gate all pass. Sanctioned route for an agent with no Write tool still unchanged: write under target/<folder>/ (a path with a target/ segment, a variable holding it, or a cd into it); never a tracked source path.

## History
- [2026-11-17 16:15] (created) bug — source-shell-write blocks a heredoc that writes a scratch .py under target/perf/aa-captures/ (gitignored, not repo source) for a subagent th
- [2026-11-17 16:29] (comment) criterion added: A heredoc writing a source-extension file into a gitignored scratch folder under target/ passes however the command names the folder (literal, cd, mkdir -p then cd, assigned variable); the same shapes aimed at tracked source, an unassigned or reassigned variable and a missing cd target still block
- [2026-11-17 16:29] (comment) ticked: A heredoc writing a source-extension file into a gitignored scratch folder under target/ passes however the command names the folder (literal, cd, mkdir -p then cd, assigned variable); the same shapes aimed at tracked source, an unassigned or reassigned variable and a missing cd target still block
- [2026-11-17 16:29] (status) todo → review
