---
id: KIT-T743
title: q gap: 'code' has no --running flag
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T00:04:29Z
updated: 2026-10-31T01:18:12Z
fixed_commit: 5a59504
---

## Description
q code --running --path C:/Users/Chris Sparks/.claude/claude-kit-runtime/current/scripts/broker

kit-bug-shape: q-gap:flag:code:--running
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
[no-test: not a defect] --running is not a q flag and nothing needs one: the call's intent (search the code the live broker runs) already works as q code <text> --path <runtime>/current/scripts/broker, which scans the runtime from disk (KIT-T452, 5a59504; checked 2026-10-31, hits in overrun.mjs from both the repo and a foreign cwd). The unquoted path in the filing held a space (C:/Users/Chris Sparks/...), which splits into two args and made the unknown-flag path fire first.

## History
- [2026-10-31 00:04] (created) bug — q gap: 'code' has no --running flag
- [2026-10-31 01:18] (status) todo → done
