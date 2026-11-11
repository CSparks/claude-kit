---
id: KIT-T991
title: hand-write-detect (source-shell-write, KIT-T706) flags byte-identical git mv renames as hand-written source: HOD moved 41 files into legacy/
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:13:21Z
updated: 2026-11-11T03:13:21Z
---

## Description
hand-write-detect (source-shell-write, KIT-T706) flags byte-identical git mv renames as hand-written source: HOD moved 41 files into legacy/ with git mv (git status shows R100 renames) and the PostToolUse block demands re-saving each through Edit/Write, and the commit gate would refuse. Same family as KIT-T963 (git stash) and KIT-T731 (deletions). Fix: treat index renames with identical blob hash (git diff --cached -M --name-status R100) as non-writes. Needed by HOD-D105 legacy-freeze gate, which must allow git mv INTO legacy/.

kit-bug-shape: cap:bug:hand-write-detect-source-shell-write-kit-t706-fl
first seen in hustle-or-die. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] byte-identical git mv renames (R100, equal blob ids and modes) are no hand write and do not hold commit-gate (hand-write-restore 29 passed)

## Plan
1.

## Notes
Commits 05746b8, f0acc0a; same publish blocker as KIT-T989.

## History
- [2026-11-11 03:13] (created) bug — hand-write-detect (source-shell-write, KIT-T706) flags byte-identical git mv renames as hand-written source: HOD moved 41 files into legacy/
- [2026-11-11 04:04] (comment) criterion added: byte-identical git mv renames (R100, equal blob ids and modes) are no hand write and do not hold commit-gate (hand-write-restore 29 passed)
- [2026-11-11 04:04] (comment) ticked: byte-identical git mv renames (R100, equal blob ids and modes) are no hand write and do not hold commit-gate (hand-write-restore 29 passed)
