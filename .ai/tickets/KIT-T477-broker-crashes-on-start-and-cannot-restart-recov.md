---
id: KIT-T477
title: broker crashes on start and cannot restart: recoverInflight (preimage.mjs:36) calls rmSync on a DIRECTORY entry (crates/dirt-empire/assets/a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T15:08:31Z
updated: 2026-10-14T15:19:40Z
---

## Description
broker crashes on start and cannot restart: recoverInflight (preimage.mjs:36) calls rmSync on a DIRECTORY entry (crates/dirt-empire/assets/audio/engine/candidates, from inflight job j-mv7wjniz-lxhk08, a patch deleting a whole directory) -> EISDIR; the daemon died mid-job at 2026-10-14 09:26:55Z with 5 jobs queued (dirt-empire, runtime fffca34). Also: patch-workers cannot restart a dead daemon (auto-mode classifier denies it), so a crash strands the whole queue; land titles get '(implements X)' appended twice when the worker's title already carries it (7031c69).

kit-bug-shape: cap:bug:broker-crashes-on-start-and-cannot-restart-recov
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A directory delete expands to its tracked files; check-only restores them, a landing commits each removal; a crash journal with a directory entry recovers with no failed entry and the tree at HEAD (dirdelete.test.mjs; 37eb09d)
- [x] A title already carrying (implements <ticket>) is not cited twice (land.test.mjs; 37eb09d)

## Plan
1.

## History
- [2026-10-14 15:08] (created) bug — broker crashes on start and cannot restart: recoverInflight (preimage.mjs:36) calls rmSync on a DIRECTORY entry (crates/dirt-empire/assets/a
- [2026-10-14 15:19] (comment) criterion added: A directory delete expands to its tracked files; check-only restores them, a landing commits each removal; a crash journal with a directory entry recovers with no failed entry and the tree at HEAD (dirdelete.test.mjs; 37eb09d)
- [2026-10-14 15:19] (comment) criterion added: A title already carrying (implements <ticket>) is not cited twice (land.test.mjs; 37eb09d)
- [2026-10-14 15:19] (comment) ticked: A directory delete expands to its tracked files; check-only restores them, a landing commits each removal; a crash journal with a directory entry recovers with no failed entry and the tree at HEAD (dirdelete.test.mjs; 37eb09d)
- [2026-10-14 15:19] (comment) ticked: A title already carrying (implements <ticket>) is not cited twice (land.test.mjs; 37eb09d)
- [2026-10-14 15:19] (comment) @claude: Fixed 37eb09d: plan.mjs expands a directory delete (git ls-tree -r) for submit and the daemon; showFile uses cat-file bl (full comment #1 in ## Notes)
### comment #1 [2026-10-14 15:19] @claude
Fixed 37eb09d: plan.mjs expands a directory delete (git ls-tree -r) for submit and the daemon; showFile uses cat-file blob so a directory never reads as text; restore skips a directory journalled as absent and tries every entry. dirt-empire inflight.json checked read-only: 19 file entries hash-identical to the tree, so recovery is a no-op and the tree stays at HEAD. Open from this ticket: patch-workers cannot restart a dead daemon (auto-mode denies it), not addressed here. 143 broker tests pass; each new guard mutation-checked.
- [2026-10-14 15:19] (status) todo → review
