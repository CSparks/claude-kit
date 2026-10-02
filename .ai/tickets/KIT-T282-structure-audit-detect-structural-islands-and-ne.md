---
id: KIT-T282
title: Structure audit: detect structural islands and nesting smells in code trees — crate/src/<crate-name>/ doubling, single-file folders, folders not grouped by concern, two homes for one concern, orphan modules, files over the size gate, style drift between sibling crates
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-T284]
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:08:16Z
updated: 2026-10-02T15:35:27Z
---

## Description
scripts/structure-audit.mjs on the shared walker (scripts/tree-walk.mjs) and doc-tree units: rules name-doubling, single-file-folder, ungrouped-folder (>20 source files), two-homes (util/utils/helpers/common in one unit), orphan-module (Rust: mod decl or #[path]), file-over-soft/hard (limits now shared in hooks/lib/limits.mjs with pre-write), style-drift (sibling crates: missing src/, mod.rs vs name.rs, mixed). Orphan detection is Rust-only; JS/TS importers stay code-graph's. Run read-only 2026-10-02: stiletto 12 hard + 95 soft oversize, 7 orphan-module, 20 single-file-folder, 8 style-drift, 8 two-homes, 5 ungrouped; rapid-game 11 hard + 68 soft, 34 orphan-module (before #[path] fix), 21 single-file-folder, 7 style-drift, 9 ungrouped. Tests: scripts/structure-audit.test.mjs (12, positive + negative control per rule). Criterion 3 weekly wiring lands with KIT-T281.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Reports each finding with path and rule; runs on stiletto and rapid-game
- [x] Fixture tests for each smell (one positive, one negative control)
- [x] Wired into the weekly review and available on demand

## Plan
1.

## History
- [2026-10-02 15:08] (created) feature — Structure audit: detect structural islands and nesting smells in code trees — crate/src/<crate-name>/ doubling, single-file folders, folders not grouped by concern, two homes for one concern, orphan modules, files over the size gate, style drift between sibling crates
- [2026-10-02 15:08] (comment) criterion added: Reports each finding with path and rule; runs on stiletto and rapid-game
- [2026-10-02 15:08] (comment) criterion added: Fixture tests for each smell (one positive, one negative control)
- [2026-10-02 15:08] (comment) criterion added: Wired into the weekly review and available on demand
- [2026-10-02 15:24] (comment) ticked: Reports each finding with path and rule; runs on stiletto and rapid-game
- [2026-10-02 15:24] (comment) ticked: Fixture tests for each smell (one positive, one negative control)
- [2026-10-02 15:24] (status) todo → doing
- [2026-10-02 15:35] (comment) ticked: Wired into the weekly review and available on demand
- [2026-10-02 15:35] (status) doing → review
