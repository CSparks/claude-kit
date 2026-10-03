---
id: KIT-T314
title: comment-sweep (scripts/comment-sweep.mjs) and the comment gate skip TOML files (.cargo/config.toml is 42 of 58 lines comment; framework mani
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T18:41:29Z
updated: 2026-10-03T18:46:23Z
---

## Description
comment-sweep (scripts/comment-sweep.mjs) and the comment gate skip TOML files (.cargo/config.toml is 42 of 58 lines comment; framework manifests carry 471 comment lines) and ignore ticket-id backstory in comments (1,440 ticket-citing comment lines in stiletto, 677 in rapid-game, while the narration detector finds only 13). Cover TOML comments and flag ticket-id backstory per KIT-D078 (a bare id is the ceiling; a sentence of ticket history is narration).

kit-bug-shape: cap:feature:comment-sweep-scripts-comment-sweep-mjs-and-the-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] comment gate and sweep cover TOML comments (Cargo.toml, .cargo/config.toml) and flag ticket-history narration

## Plan
1.

## History
- [2026-10-03 18:41] (created) feature — comment-sweep (scripts/comment-sweep.mjs) and the comment gate skip TOML files (.cargo/config.toml is 42 of 58 lines comment; framework mani
- [2026-10-03 18:46] (comment) criterion added: comment gate and sweep cover TOML comments (Cargo.toml, .cargo/config.toml) and flag ticket-history narration
- [2026-10-03 18:46] (comment) ticked: comment gate and sweep cover TOML comments (Cargo.toml, .cargo/config.toml) and flag ticket-history narration
- [2026-10-03 18:46] (comment) @sonnet55: pre-write.mjs now runs the comment checks for .toml before the data-file early exit; comment-sweep.mjs includes TOML; co (full comment #1 in ## Notes)
### comment #1 [2026-10-03 18:46] @sonnet55
pre-write.mjs now runs the comment checks for .toml before the data-file early exit; comment-sweep.mjs includes TOML; comment-scan.mjs gets a ticket-history pattern (since/after/before <id>, <id> <past-tense verb>, was ... in <id>); a bare id and fix-for references pass. Tests: hooks/comment-gate.test.mjs 36 passed (+12, incl. negative controls: bare id, verb without id, short TOML comment, json untouched). Mutations: toml block off fails 3; ticket pattern removed fails 5. pre-write 36, lint 3, exclusions pass. Sweep over claude-kit reports 40 narrating comments.
- [2026-10-03 18:46] (status) todo → review
