---
id: KIT-T650
title: broker: land binary files (a glb, a png) in a patch envelope — envelope write/edit are text-only, so a game asset binary has to be hand-comm
type: feature
status: review
priority: high
asked: 2
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T15:46:12Z
updated: 2026-10-27T22:00:27Z
---

## Description
broker: land binary files (a glb, a png) in a patch envelope — envelope write/edit are text-only, so a game asset binary has to be hand-committed outside the broker (found landing DE-T183 L1 trophy_truck.glb)

kit-bug-shape: cap:feature:broker-land-binary-files-a-glb-a-png-in-a-patch-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A patch envelope lands a binary file byte for byte

## Plan
1.

## Notes
2026-10-27 Binary files ride the patch envelope. Envelope: '*** write-binary <path>' + base64 lines (envelope.mjs) -> op {kind:'write-binary', path, base64}; apply.mjs dryRun makes the file a Buffer (create, or replace a tracked file whole; untracked collision = create-exists; an edit of binary bytes = binary-file); green.mjs hashes the bytes so two binaries are two cache keys; gate.mjs skips non-text files; the existing journal/restore/commit paths already work on bytes. CLI: 'submit.mjs --binary <repo path>=<file>' (repeatable, new binary-flag.mjs, 64 MiB cap because the queued job carries the base64) needs no stdin envelope; usage text updated. Tests: scripts/broker/binary.test.mjs 10 passed (envelope, dryRun, green key, byte-exact landing + push, tracked-binary replace, check-only leaves the tree, untracked collision, CLI flag, bad spec/missing file); mutation: write-binary branch off -> 5 fail; plus patch/land/submit-usage/green/gate-lock/train/linked/pin/batch/incremental/coalesce/landgate 72 passed. A publish ships the new op to broker daemons only after each restarts; until then a daemon predating it reads '*** write-binary' as a malformed envelope, so publish and restart together. Not done: a LFS-tracked path (git add runs the filter on the written bytes, untested here); the 64 MiB limit is a guess to confirm with the first real glb.

## History
- [2026-10-27 15:46] (created) feature — broker: land binary files (a glb, a png) in a patch envelope — envelope write/edit are text-only, so a game asset binary has to be hand-comm
- [2026-10-27 15:46] (comment) seen again in dirt-empire: broker: land binary files (a glb, a png) in a patch envelope - envelope write/edit are text-only, so a game asset binary has to be hand-committed outside the broker (found landing DE-T183 L1 trophy_truck.glb)
- [2026-10-27 15:46] (asked again) 2026-10-27 — cap:feature:broker-land-binary-files-a-glb-a-png-in-a-patch-
- [2026-10-27 22:00] (comment) criterion added: A patch envelope lands a binary file byte for byte
- [2026-10-27 22:00] (comment) ticked: A patch envelope lands a binary file byte for byte
- [2026-10-27 22:00] (status) todo → review
