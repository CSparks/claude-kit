---
id: KIT-T522
title: Linked job's --manifest-path test refused: '-p rg-physics not a workspace member' (dirt-empire, relayed by main). The message is not produced by broker source (q code finds no such text); cargo emits it when the nested manifest resolves its workspace root to the superproject. Needs the job id/log and dirt-empire Cargo.toml workspace/exclude to confirm; also 'cargo t' alias is not visible from the superproject root (.cargo lives in rapid-game)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T18:25:03Z
updated: 2026-10-15T18:25:03Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 18:25] (created) bug — Linked job's --manifest-path test refused: '-p rg-physics not a workspace member' (dirt-empire, relayed by main). The message is not produced by broker source (q code finds no such text); cargo emits it when the nested manifest resolves its workspace root to the superproject. Needs the job id/log and dirt-empire Cargo.toml workspace/exclude to confirm; also 'cargo t' alias is not visible from the superproject root (.cargo lives in rapid-game)
- [2026-10-15 19:43] (comment) @claude: cause: the superproject workspace (members=crates/dirt-empire, exclude=rapid-game) does not contain rapid-game crates; ' (full comment #1 in ## Notes)
### comment #1 [2026-10-15 19:43] @claude
cause: the superproject workspace (members=crates/dirt-empire, exclude=rapid-game) does not contain rapid-game crates; 'cargo test -p rg-physics' run against it fails 'package rg-physics cannot be tested because it requires dev-dependencies and is not a member of the workspace' (reproduced read-only). The exact reported command with --manifest-path rapid-game/rust/Cargo.toml resolves correctly from the superproject root (cargo metadata: workspace_root rapid-game/rust, rg-physics member; cargo tree -p rg-physics --features streaming ok), so the failing run lacked an effective manifest-path. No broker source change; [no-test: diagnosis]
