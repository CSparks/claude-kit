---
id: KIT-T1255
title: source-shell-write PostToolUse (KIT-T706) misfires in a shared checkout: a Bash call that only ran cp of a PNG under target/ and cargo build
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T11:17:34Z
updated: 2026-11-15T12:11:01Z
---

## Description
source-shell-write PostToolUse (KIT-T706) misfires in a shared checkout: a Bash call that only ran cp of a PNG under target/ and cargo build (2 min) was blamed for source files other writers edited meanwhile (rg-graphics sky/volume, rg-shader-kit built/ground, rg-buildings). It should attribute by writer or ignore files the call's process did not write; as it stands every long call by any agent in a multi-writer tree trips it, and it says a commit holding those files is refused.

kit-bug-shape: cap:bug:source-shell-write-posttooluse-kit-t706-misfires:52e938f5
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 9f611ce. The live ledger shows one Post flagging seven source files of four agents at once, none edited during the call (last Edit-ledger entries up to an hour older): a same-content rewrite by another process (git stash/pop, an autostash pull, a checkout of the same text) changed their mtime, and the snapshot signature included mtime, so they read as changed and older Edit entries could not excuse them. A source file's signature is now size and content hash only (shell-snapshot.mjs); a touch is no change. Another agent's accepted Edit during the call was already excused by the ledger match and is now a test (hooks/hand-write-edit-sequences.test.mjs, mutation-checked).

## History
- [2026-11-15 11:17] (created) bug — source-shell-write PostToolUse (KIT-T706) misfires in a shared checkout: a Bash call that only ran cp of a PNG under target/ and cargo build
- [2026-11-15 12:09] (landed) 9f611ce The hand-write check no longer blames a shell call for an Edit's content or for a touched file, and a commit refuses a s
- [2026-11-15 12:11] (status) todo → review
