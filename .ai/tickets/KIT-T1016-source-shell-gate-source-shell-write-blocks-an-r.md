---
id: KIT-T1016
title: source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:40:32Z
updated: 2026-11-11T04:40:32Z
---

## Description
source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/zz-repro.test.mjs): a deletion leaves nothing for pre-write to judge and hand-write-detect already counts a deleted path as no write, so the gate should let rm of a source path pass; also prevention for process failures 1-2 (agent wrote a repro via a bash heredoc, then a node one-liner naming the file): the block text should say 'use the Write tool' with the Write form first

kit-bug-shape: cap:bug:source-shell-gate-source-shell-write-blocks-an-r
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Prevention landed in code (commit 9c4abae): hooks/source-shell-gate.mjs block text now leads with Use the Write tool (create or replace a whole file, a scratch repro or test included, never a heredoc, echo-redirect or node -e), then the Edit tool; test hooks/source-shell-gate.test.mjs 168 passed. NOT done: letting rm of a source path pass. hooks/source-shell-gate.test.mjs asserts node fs.rmSync on a source file blocks, so that is a policy reversal of a tested contract (and WRITING_CMD is shared with the store gate where rm must block); needs the maintainer call, or a separate scoped change tagging delete-only hits in shell-write-scan. No CLAUDE.md or agent-definition text proposed. Left untouched and uncommitted: hooks/zz-repro.test.mjs (previous agent scratch repro, never add or commit).
### comment #2 [2026-11-13 20:49] @claude
State check 2026-11-13: the rm of an untracked file the caller wrote is lifted in non-ambiguous source-gate lines (b307724, KIT-T1066, source-shell-gate.mjs:39). Still open: in an ambiguous-quoting line (PowerShell tool) an rm hit carries no path or deletes flag, so the lift cannot apply. Related fix for the store gate: eab1b32 (KIT-T1154).

## History
- [2026-11-11 04:40] (created) bug — source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (a scratch repro hooks/
- [2026-11-11 04:40] (comment) seen again in claude-kit: source-shell-gate (source-shell-write) blocks an rm of an untracked source file the same agent created through Write (scratch repro): deletion leaves nothing for pre-write to judge
- [2026-11-11 04:40] (asked again) 2026-11-11 — cap:bug:source-shell-gate-source-shell-write-blocks-an-r
- [2026-11-11 05:02] (landed) 9c4abae shell-segments: only a quote opened right after a dollar sign is a dollar-quote ambiguity, so a grep pattern ending in a
- [2026-11-11 05:02] (comment) @claude: Block-text prevention landed in 9c4abae; the rm-of-a-source-path part is open (policy call, see Notes)
- [2026-11-11 05:02] (landed) 1110b6d tickets: KIT-T1018 to review with fix sha, KIT-T1016 notes (implements KIT-T1018, KIT-T1016)
- [2026-11-13 20:49] (comment) @claude: State check 2026-11-13: the rm of an untracked file the caller wrote is lifted in non-ambiguous source-gate lines (b3077 (full comment #2 in ## Notes)
