---
id: KIT-T706
title: source-shell-gate gap 2: a scratch node or python script that writes through a variable path (const p = 'hooks/' + x; writeFileSync(p, …)) e
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:52:47Z
updated: 2026-10-29T17:41:14Z
fixed_commit: b75a8d5
---

## Description
source-shell-gate gap 2: a scratch node or python script that writes through a variable path (const p = 'hooks/' + x; writeFileSync(p, …)) evades the code check, which only looks for literal quoted paths. The KIT-T701 writer bypassed the gate this way once by accident on 2026-10-29, which makes it a live KIT-D113 case. Fix: block any scratch script or inline -e/-c that contains a write call (writeFileSync/appendFileSync/unlinkSync/open-for-write) when run from inside a repo, unless every write target resolves into the scratchpad, a temp dir or .ai.

kit-bug-shape: cap:bug:source-shell-gate-gap-2-a-scratch-node-or-python
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 16:52] (created) bug — source-shell-gate gap 2: a scratch node or python script that writes through a variable path (const p = 'hooks/' + x; writeFileSync(p, …)) e
- [2026-10-29 17:04] (status) todo → done
- [2026-10-29 17:04] (comment) @claude: Tests: hooks/source-shell-gate.test.mjs 122 passed (variable-path blocks, literal scratchpad passes, no-write script pas (full comment #1 in ## Notes)
### comment #1 [2026-10-29 17:04] @claude
Tests: hooks/source-shell-gate.test.mjs 122 passed (variable-path blocks, literal scratchpad passes, no-write script passes). A literal non-source repo path still passes as before; only a non-literal target fails closed.
- [2026-10-29 17:04] (landed) 4e08ff1 implements KIT-T706: source-shell-gate blocks a script whose write target is not a literal path
- [2026-10-29 17:05] (status) done → done
- [2026-10-29 17:10] (landed) 3ee49b2 implements KIT-T706: revert the write-target sink parser; a parser of agent code never decides an allow (KIT-D117)
- [2026-10-29 17:41] (landed) b75a8d5 implements KIT-T706: hand-write-detect catches a source hand write by its effect (repo state diff around a shell call),
- [2026-10-29 17:41] (status) done → done
- [2026-10-29 17:41] (comment) @claude: Re-landed as an effect detector (KIT-D117): hooks/hand-write-detect.test.mjs 28 passed, hooks/source-shell-gate.test.mjs (full comment #2 in ## Notes)
### comment #2 [2026-10-29 17:41] @claude
Re-landed as an effect detector (KIT-D117): hooks/hand-write-detect.test.mjs 28 passed, hooks/source-shell-gate.test.mjs 123 passed, commit-gate 42, shell-writes 7. The literal-path sink parser (4e08ff1) was reverted in 3ee49b2. Snapshot cost on dirt-empire: median 95 ms, max 240 ms (git status -uall plus stat of dirty files).
