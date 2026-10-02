---
id: KIT-T283
title: Comment-length and comment-content gate: warn on oversized prose in code comments (doc comment blocks over a few lines, inline comment runs, comment-to-code ratio per file) and on comments that narrate recent discussion instead of what the code does; extends KIT-T207 (backstory gate)
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-T207]
files: []
supersedes: KIT-T207
superseded_by:
created: 2026-10-02T15:08:19Z
updated: 2026-10-02T15:35:29Z
---

## Description
Comment prose gate in pre-write (hooks/lib/comment-scan.mjs scanner, hooks/lib/comment-gate.mjs glue): check-id comment-length warns over 6 lines and BLOCKS over 20 (whole-file Write also warns when comments exceed 40% of a 40+ line file); check-id comment-narration BLOCKS dated stamps, maintainer/user attribution, quoted discussion, decision-process narration, conversation references and profanity (KIT-T207 folded in, no second gate; a bare ticket id stays legal). Standard exclusions: .claude-kit-ignore.yaml globs and claude-kit-ignore markers. Sweep: scripts/comment-sweep.mjs [root] [--top N] [--json]. Read-only sweep of stiletto 2026-10-02: heaviest crates/materials/src/render/materials/kind.rs (220 comment lines), longest block examples/battle_bench.rs:1 (55 lines), 19 narrating comments (dated stamps, quoted discussion). Note: whole-file Writes of existing files with 20+ line headers will now block until trimmed. Tests: hooks/comment-gate.test.mjs (24; 9 fail with the gate removed).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Pre-write gate warns (then blocks per halt policy) on comment blocks over a set line count and on discussion-narrating comments, with the standard exclusion surfaces
- [x] A repo sweep reports the worst files by comment lines and longest blocks, for cleanup tickets
- [x] Tests: long block flagged, short contract doc comment passes, quoted discussion flagged

## Plan
1.

## History
- [2026-10-02 15:08] (created) feature — Comment-length and comment-content gate: warn on oversized prose in code comments (doc comment blocks over a few lines, inline comment runs, comment-to-code ratio per file) and on comments that narrate recent discussion instead of what the code does; extends KIT-T207 (backstory gate)
- [2026-10-02 15:08] (comment) criterion added: Pre-write gate warns (then blocks per halt policy) on comment blocks over a set line count and on discussion-narrating comments, with the standard exclusion surfaces
- [2026-10-02 15:08] (comment) criterion added: A repo sweep reports the worst files by comment lines and longest blocks, for cleanup tickets
- [2026-10-02 15:08] (comment) criterion added: Tests: long block flagged, short contract doc comment passes, quoted discussion flagged
- [2026-10-02 15:26] (comment) ticked: Pre-write gate warns (then blocks per halt policy) on comment blocks over a set line count and on discussion-narrating comments, with the standard exclusion surfaces
- [2026-10-02 15:26] (comment) ticked: A repo sweep reports the worst files by comment lines and longest blocks, for cleanup tickets
- [2026-10-02 15:26] (comment) ticked: Tests: long block flagged, short contract doc comment passes, quoted discussion flagged
- [2026-10-02 15:26] (status) todo → doing
- [2026-10-02 15:35] (status) doing → review
