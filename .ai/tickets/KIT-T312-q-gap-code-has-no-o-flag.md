---
id: KIT-T312
title: q gap: 'code' has no -o flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T18:17:53Z
updated: 2026-10-10T00:41:34Z
---

## Description
q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/terrain/src --limit 0 -o

kit-bug-shape: q-gap:flag:code:-o
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-03 18:17] (created) bug — q gap: 'code' has no -o flag
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/loot/src --limit 0 -o
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/stations/src --limit 0 -o
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/combat/src --limit 0 -o
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/hud/src --limit 0 -o
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/editor/src --limit 0 -o
- [2026-10-03 18:17] (comment) seen again in stiletto-2349: q code (?<![:\w])view::[a-z_:]+ --regex --lang rust --path crates/testkit/src --limit 0 -o
- [2026-10-10 00:27] (status) todo → doing
- [2026-10-10 00:41] (comment) @claude: 2026-10-09 q code -o prints each matched substring with path:line (buildExtractor in code-index-query.mjs). Test in scripts/code-index.test.mjs (-o cases); code-index 22 passed.
- [2026-10-10 00:41] (status) doing → review
