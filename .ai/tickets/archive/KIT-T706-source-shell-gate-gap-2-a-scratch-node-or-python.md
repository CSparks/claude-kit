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
updated: 2026-10-29T17:05:23Z
fixed_commit: 4e08ff1
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
