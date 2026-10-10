---
id: KIT-T344
title: q gap: a grep followed an empty q file for the same terms
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T08:01:11Z
updated: 2026-10-06T08:01:11Z
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
