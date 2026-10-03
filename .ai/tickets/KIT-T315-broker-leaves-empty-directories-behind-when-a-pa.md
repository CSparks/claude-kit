---
id: KIT-T315
title: broker leaves empty directories behind when a patch deletes or moves every file out of them: after ST-T824 landed aeeb0ee7 (bay::screens ->
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T21:47:33Z
updated: 2026-10-03T21:49:19Z
---

## Description
broker leaves empty directories behind when a patch deletes or moves every file out of them: after ST-T824 landed aeeb0ee7 (bay::screens -> bay), crates/bay/src/screens/{bay,context,dock,inventory,layout,shop} remain as empty folders in the live checkout, and the check-only run of the next job leaves crates/hud/src/screens/hud the same way. Empty folders confuse anyone reading the tree and trip directory-scanning guard tests. The apply/restore and land paths should prune any directory a patch empties (and restore must recreate dirs it removed).

kit-bug-shape: cap:bug:broker-leaves-empty-directories-behind-when-a-pa
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a patch that empties a folder leaves no empty folder after landing; a check-only run restores folders

## Plan
1.

## History
- [2026-10-03 21:47] (created) bug — broker leaves empty directories behind when a patch deletes or moves every file out of them: after ST-T824 landed aeeb0ee7 (bay::screens ->
- [2026-10-03 21:49] (comment) criterion added: a patch that empties a folder leaves no empty folder after landing; a check-only run restores folders
- [2026-10-03 21:49] (comment) ticked: a patch that empties a folder leaves no empty folder after landing; a check-only run restores folders
- [2026-10-03 21:49] (comment) @sonnet55: writePlan (patch.mjs) prunes each deleted file's directories up to the first non-empty parent via preimage.pruneEmptyDir (full comment #1 in ## Notes)
### comment #1 [2026-10-03 21:49] @sonnet55
writePlan (patch.mjs) prunes each deleted file's directories up to the first non-empty parent via preimage.pruneEmptyDirs (never the repo root); the check-only restore recreates them because restore() mkdirs each file's parent. Tests: scripts/broker/prune.test.mjs (4: land prunes a/b and a, check-only byte-for-byte, negatives remaining tracked file / untracked file stay, root survives); mutation (no prune) fails the landing test. Broker suite 86 passed.
- [2026-10-03 21:49] (status) todo → review
