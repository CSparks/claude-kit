---
id: KIT-T528
title: broker wait.mjs hangs forever on a finished lane job: wait j-mv9un9kq-f2y0gh --root D:/dev/dirt-empire/rapid-game (pid 48252, started 15:29
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T20:34:57Z
updated: 2026-10-16T14:58:52Z
---

## Description
broker wait.mjs hangs forever on a finished lane job: wait j-mv9un9kq-f2y0gh --root D:/dev/dirt-empire/rapid-game (pid 48252, started 15:29 local, from D:/dev/claude-kit source) never returns; the lane daemon (pid 50564, --root D:/dev/dirt-empire --lane rapid-game) wrote the result to D:/dev/dirt-empire/target/broker/lanes/rapid-game/results/j-mv9un9kq-f2y0gh.json (failed, finishedAt 20:31:39Z). wait resolves results from the --root it is given (the submodule path), where no daemon writes, and has no fail-fast for 'no live broker beat at this root' or 'job id unknown here'. Agents sit in a wait whose timer never moves. Fix: wait (and submit) resolve a submodule root to its parent's lane dir; wait errors at once when no daemon beat serves the root or the job is unknown; a STALLED/timeout exit names the job and the result path. Test: wait on a lane job with the submodule as --root returns the result; wait on an unserved root exits nonzero within seconds. Recurring (Chris 2026-10-15: 'Agents running with timers not counting down. Again.')

kit-bug-shape: cap:bug:broker-wait-mjs-hangs-forever-on-a-finished-lane
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 20:34] (created) bug — broker wait.mjs hangs forever on a finished lane job: wait j-mv9un9kq-f2y0gh --root D:/dev/dirt-empire/rapid-game (pid 48252, started 15:29
- [2026-10-16 14:58] (comment) @claude: Implementing commit 2b3ff92 (--root naming a submodule maps to the parent's lane; wait exits 3 on an unknown job id and  (full comment #1 in ## Notes)
### comment #1 [2026-10-16 14:58] @claude
Implementing commit 2b3ff92 (--root naming a submodule maps to the parent's lane; wait exits 3 on an unknown job id and names the result path on timeout; root-map 2 passed, wait/idle 7 passed). Status drift fixed: todo -> review.
- [2026-10-16 14:58] (status) todo → review
