---
id: KIT-T746
title: hand-write-detect false positive: a broker client call (watch.mjs, wait.mjs, submit.mjs) is blamed for the source files a broker landing wrote during it (dirt-empire DE-T256, j-mvvn1t1y-k0zczz, commit 9d26d5b)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T00:11:52Z
updated: 2026-10-31T00:13:45Z
---

## Description
The coordinator ran only node watch.mjs; the broker landing applied crates/dirt-empire/src/app.rs, free_ride/sky.rs, graphics.rs, tests/app/free_ride_sky.rs, tests/app/main.rs meanwhile, and hand-write-detect (source-shell-write, KIT-T706) ledgered them as the shell's hand writes. KIT_TOOL in hooks/lib/shell-snapshot.mjs does not cover the broker client scripts, so isGeneratorCommand is false. Fix: the broker client scripts count as generator commands. Same family as KIT-T735 (readers).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T735, KIT-T709, KIT-T706
Fixed: hooks/lib/shell-snapshot.mjs treats a node call of submit/wait/watch/broker.mjs with no file redirect as a generator command, so a landing that writes the tree meanwhile is the broker's, not the shell's. Tests: hand-write-detect 38 (3 negative controls plus a redirect control), shell-writes 7, source-shell-gate 125 passed.

## History
- [2026-10-31 00:11] (created) bug — hand-write-detect false positive: a broker client call (watch.mjs, wait.mjs, submit.mjs) is blamed for the source files a broker landing wrote during it (dirt-empire DE-T256, j-mvvn1t1y-k0zczz, commit 9d26d5b)
- [2026-10-31 00:13] (status) todo → review
