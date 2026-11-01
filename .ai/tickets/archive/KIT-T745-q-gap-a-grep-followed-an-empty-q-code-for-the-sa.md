---
id: KIT-T745
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T00:09:40Z
updated: 2026-10-31T01:18:14Z
fixed_commit: 3028231
---

## Description
q: q code "CENSUS|panicked|is over|clumped|saguaro" --dir target/broker/logs --regex 2>&1  then  grep: CENSUS|panicked|assert|over |clumped

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Reproduced the exact command on a copy of the dirt-empire broker job logs (1381 files): q code with --dir and --regex finds CENSUS/panicked hits, in the current tree and in runtime 773fb4a, so there is no q defect for that call; the later grep widened the terms (assert, over). Remaining gap fixed: an empty --dir answer now states the files read and the files skipped (binary, too large, unreadable) so an empty scan proves absence only for what it read. Commit 3028231. Evidence: scripts/q-gaps.test.mjs 11 passed, code-index 26, q 112, q-server 8.

## History
- [2026-10-31 00:09] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-10-31 01:06] (landed) 3028231 q code --dir: an empty answer states the files read and the files skipped (binary, too large, unreadable), so an empty s
- [2026-10-31 01:18] (status) todo → done
