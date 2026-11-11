---
id: KIT-T1009
title: source-shell-write post-hook (KIT-T706) attributes another parallel agent's concurrent file edits to my shell call (named VizPresetsUi.kt an
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:09:04Z
updated: 2026-11-11T04:09:04Z
---

## Description
source-shell-write post-hook (KIT-T706) attributes another parallel agent's concurrent file edits to my shell call (named VizPresetsUi.kt and PresetSourceTest.kt, files I never touched) and blocks my turn; in a multi-agent checkout it should only flag files changed by this session's own shell command

kit-bug-shape: cap:bug:source-shell-write-post-hook-kit-t706-attributes
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:09] (created) bug — source-shell-write post-hook (KIT-T706) attributes another parallel agent's concurrent file edits to my shell call (named VizPresetsUi.kt an
