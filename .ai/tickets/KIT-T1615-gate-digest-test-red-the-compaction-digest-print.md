---
id: KIT-T1615
title: gate-digest test red: the compaction digest prints 18 lines against its 16-line budget; d512a05a (question-bundle check) took it from 16 to
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T19:53:13Z
updated: 2026-11-27T19:55:14Z
---

## Description
gate-digest test red: the compaction digest prints 18 lines against its 16-line budget; d512a05a (question-bundle check) took it from 16 to 17 and e5c9510a (prior-work check) to 18. Root cause: gateDigest packs entries in definition order and prints every tag's full placeholder text, so each new check adds a line with no headroom. Fix: shorten long placeholders in the digest only (gate-tokens forms unchanged) so it fits with headroom; budget unchanged.

kit-bug-shape: cap:bug:gate-digest-test-red-the-compaction-digest-print:26afa5ed
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-27 19:53] (created) bug — gate-digest test red: the compaction digest prints 18 lines against its 16-line budget; d512a05a (question-bundle check) took it from 16 to
- [2026-11-27 19:54] (landed) 20059443 gate digest: a placeholder over three words keeps its first three (`<stashes, untracked files …>`), a dangling "or" or c
- [2026-11-27 19:55] (status) todo → review
- [2026-11-27 19:55] (comment) @claude: fixed in 20059443: digest placeholders over three words cut to their first three; digest 18 -> 15 lines, widest 127, bud (full comment #1 in ## Notes)
### comment #1 [2026-11-27 19:55] @claude
fixed in 20059443: digest placeholders over three words cut to their first three; digest 18 -> 15 lines, widest 127, budget unchanged. Over-budget commits: d512a05a (16->17), e5c9510a (17->18). gate-digest 12, question-bundle-gate 44, question-wait-gate 33 pass.
