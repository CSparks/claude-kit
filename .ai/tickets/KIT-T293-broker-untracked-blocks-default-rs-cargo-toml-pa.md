---
id: KIT-T293
title: broker untracked_blocks default (**/*.rs, **/Cargo.toml) pauses forever on a repo with an untracked standalone crate outside the workspace (
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T18:15:25Z
updated: 2026-10-13T19:50:07Z
---

## Description
broker untracked_blocks default (**/*.rs, **/Cargo.toml) pauses forever on a repo with an untracked standalone crate outside the workspace (stiletto tools/generator-reload); derive the block set from cargo workspace members instead of a glob. Stiletto worked around it with member-scoped untracked_bl

kit-bug-shape: cap:feature:broker-untracked-blocks-default-rs-cargo-toml-pa
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-02 18:15] (created) feature — broker untracked_blocks default (**/*.rs, **/Cargo.toml) pauses forever on a repo with an untracked standalone crate outside the workspace (
- [2026-10-13 19:50] (comment) @sonnet55: Fixed ec1df70: untracked_blocks default is derived from tracked crates and [workspace] members (scripts/broker/blocks.mj (full comment #1 in ## Notes)
### comment #1 [2026-10-13 19:50] @sonnet55
Fixed ec1df70: untracked_blocks default is derived from tracked crates and [workspace] members (scripts/broker/blocks.mjs); explicit config unchanged; glob fallback without a tracked Cargo.toml. Verified read-only on stiletto (46 globs) and rapid-game (158): 0 untracked blockers with tools/generator-reload present. Tests: scripts/broker/blocks.test.mjs (4), mutation fails the queue case, npm test exit 0. Stiletto can drop its member-scoped untracked_blocks workaround.
- [2026-10-13 19:50] (status) todo → review
