---
id: KIT-T344
title: q gap: a grep followed an empty q file for the same terms
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes: KIT-T654
superseded_by:
created: 2026-10-06T08:01:11Z
updated: 2026-11-08T16:31:12Z
fixed_commit: b6dd07f
---

## Description
q: q file "**/rg-pathfind/**/*.rs"  then  grep: rg-rng\|rg-pathfind

kit-bug-shape: q-gap:grep-after-empty-q:file
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 08:01] (created) bug — q gap: a grep followed an empty q file for the same terms
- [2026-10-06 08:40] (comment) seen again in dirt-empire: q: q file "**/editor-kit/**/controls*" then grep: rg-editor-kit
- [2026-10-09 19:54] (comment) seen again in dirt-empire: q: q file "**/rg-input/**" then Glob: rapid-game/rust/**/{fullscreen_hotkey*,rg-input/src/*.rs,rg-input/Cargo.toml}
- [2026-10-14 19:27] (comment) seen again in dirt-empire: q: q file "**/leafwing*/**/gamepad.rs" then grep: gamepad.get(\|fn get_axis\|CentralInputStore
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) q file: **/ matches zero directories; test scripts/q-gaps.test.mjs
- [2026-11-08 16:31] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
