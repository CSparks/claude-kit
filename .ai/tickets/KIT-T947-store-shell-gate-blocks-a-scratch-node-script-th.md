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

## Notes
Agent finding (no-code route, maintainer chose the documented exclusion): not satisfiable. pathExcluded(root,'store-shell-write', found.path) in hooks/store-shell-gate.mjs judges the STORE path the scan found inside the script (e.g. '.ai/tickets/', from codeWrites in hooks/lib/store-shell-write.mjs:41), never the script's own path. A scratchpad glob therefore never matches; the only glob that lifts a fixture script is a store glob like '.ai/**' or '.ai/tickets/**', which lifts the gate for every real store write in this repo. Probe: scratch script writing mkdtemp/.ai/tickets/X-T001-a.md run as node <short-form scratchpad path> returns {path:'.ai/tickets/'} (blocked); same script by long-form path returns null (readTempScript compares against tmpdir() short form, so a long-form path is never read). No gate code or yaml changed. Ready code design remains in comment #1 (mkdtemp/tmpdir root + absolute-store-path check) or: gate passes the script path to pathExcluded as a second subject. Needs the maintainer to pick a code route.

## History
- [2026-11-10 17:37] (created) bug — store-shell-gate blocks a scratch node script that writes .ai fixture files into a mkdtemp temp dir (test debugging from the scratchpad, 202
- [2026-11-10 19:21] (comment) @claude: Not changed: the fix loosens a security gate (hooks/lib/store-shell-write.mjs codeWrites would stop judging a script tha (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:21] @claude
Not changed: the fix loosens a security gate (hooks/lib/store-shell-write.mjs codeWrites would stop judging a script that builds its own mkdtemp/tmpdir root unless a literal absolute path names a real store item). The auto-mode classifier denied the edit and KIT-D154/the contract say to stop and discuss before loosening a gate. Ready design for the maintainer: TEMP_ROOT = /mkdtemp|tmpdir()/ plus ABSOLUTE_STORE (drive/~/home path followed by STORE_PATH) so a fixture script passes and an absolute real-store write still blocks; tests in hooks/store-shell-gate.test.mjs (fixture script passes, same script with an absolute store path blocks). Alternative with no code: the documented exclusion store-shell-write in .claude-kit-ignore.yaml for the scratchpad scripts.
