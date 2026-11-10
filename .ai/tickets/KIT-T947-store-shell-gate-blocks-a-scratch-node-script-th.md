---
id: KIT-T947
title: store-shell-gate blocks a scratch node script that writes .ai fixture files into a mkdtemp temp dir (test debugging from the scratchpad, 202
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:37:13Z
updated: 2026-11-10T17:37:13Z
---

## Description
store-shell-gate blocks a scratch node script that writes .ai fixture files into a mkdtemp temp dir (test debugging from the scratchpad, 2026-11-10); the scan reads the script body and cannot tell a throwaway fixture directory from the real store

kit-bug-shape: cap:bug:store-shell-gate-blocks-a-scratch-node-script-th
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 17:37] (created) bug — store-shell-gate blocks a scratch node script that writes .ai fixture files into a mkdtemp temp dir (test debugging from the scratchpad, 202
- [2026-11-10 19:21] (comment) @claude: Not changed: the fix loosens a security gate (hooks/lib/store-shell-write.mjs codeWrites would stop judging a script tha (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:21] @claude
Not changed: the fix loosens a security gate (hooks/lib/store-shell-write.mjs codeWrites would stop judging a script that builds its own mkdtemp/tmpdir root unless a literal absolute path names a real store item). The auto-mode classifier denied the edit and KIT-D154/the contract say to stop and discuss before loosening a gate. Ready design for the maintainer: TEMP_ROOT = /mkdtemp|tmpdir()/ plus ABSOLUTE_STORE (drive/~/home path followed by STORE_PATH) so a fixture script passes and an absolute real-store write still blocks; tests in hooks/store-shell-gate.test.mjs (fixture script passes, same script with an absolute store path blocks). Alternative with no code: the documented exclusion store-shell-write in .claude-kit-ignore.yaml for the scratchpad scripts.
