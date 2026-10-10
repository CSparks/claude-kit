---
id: KIT-T341
title: q: 'q code "derive_paths::*"' (with or without --path rapid-game/rust) returns (no results) from D:/dev/dirt-empire although rapid-game/rust
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T400
superseded_by:
created: 2026-10-06T04:18:57Z
updated: 2026-10-10T00:41:33Z
---

## Description
q: 'q code "derive_paths::*"' (with or without --path rapid-game/rust) returns (no results) from D:/dev/dirt-empire although rapid-game/rust/fx/rg-shader-kit/src/*.rs hold 6 'use rg_engine::{derive_paths::*' lines right after a merge moved the submodule; the Grep tool finds them. Framework submodule content invisible to q code (index stale after submodule merge, or submodule not searched).

kit-bug-shape: cap:bug:q-q-code-derive-paths-with-or-without-path-rapid
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 04:18] (created) bug — q: 'q code "derive_paths::*"' (with or without --path rapid-game/rust) returns (no results) from D:/dev/dirt-empire although rapid-game/rust
- [2026-10-10 00:27] (status) todo → doing
- [2026-10-10 00:41] (comment) @claude: 2026-10-09 Root cause: indexRoots only covered framework submodules carrying their own .ai store (frameworkStores); dirt (full comment #1 in ## Notes)
### comment #1 [2026-10-10 00:41] @claude
2026-10-09 Root cause: indexRoots only covered framework submodules carrying their own .ai store (frameworkStores); dirt-empire/rapid-game has none, so the whole submodule was skipped (not a crates-vs-rust folder issue; files come from git ls-files per submodule root). Also a root first seen after the cache was warm was never listed (changedPaths treated it as unchanged). Fix: indexRoots uses new frameworkRoots (every checked-out framework submodule), changedPaths returns null for an unseen root. Test: scripts/code-index.test.mjs 'framework submodule without a work store' (crates under rust/ and crates/, warm edit). From D:/dev/dirt-empire: q code PendingUploads -> rapid-game/rust/engine/rg-graphics/src/upload_pending.rs:16  pub struct PendingUploads {. code-index 22 passed.
- [2026-10-10 00:41] (status) doing → review
