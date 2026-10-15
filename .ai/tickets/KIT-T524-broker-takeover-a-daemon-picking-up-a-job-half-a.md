---
id: KIT-T524
title: Broker takeover: a daemon picking up a job half-applied by another daemon (old runtime to new, root to lane) must restore that job's own preimage/journal before running; today it loops 'dirty' because the only dirt is the job's own partial apply
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T18:39:16Z
updated: 2026-10-15T19:14:40Z
---

## Description
Seen 2026-10-15: an old-runtime root daemon (dc519a8) half-applied linked job j-mv9un9kq-f2y0gh into the rapid-game submodule (streaming/mod.rs modified, HEAD detached). The new rapid-game lane daemon (0211268) picked up the same job and loops 'j-mv9un9kq -> dirty' about every 3 s; the only dirt is that job's own partial apply. Fix: a daemon taking over a job recognises that job's own journal (inflight.json, any broker home that holds it: root or lane, old or new runtime), restores it, then runs. Only genuinely foreign dirt blocks. Test: kill mid-apply, hand off to a second daemon (different home/lane), it resumes clean. Control: a real foreign edit still blocks. Do not touch dirt-empire's live checkout.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T518, KIT-T519, KIT-T496
### comment #1 [2026-10-15 19:14] @claude
Done in 36f3047 (pushed). takeover.mjs: before running a job a daemon restores an unfinished journal naming it from any lane's or the root's broker home whose daemon is dead and which is not past a landing commit or a linked submodule push; hooked in queue.mjs processOnce. Tests: takeover.test.mjs 3 passed (hand-off restores and runs; no journal, another job's journal, and a live daemon's journal still block); the restore case fails without the hook. Not covered: the detached submodule HEAD an old daemon left (not dirt, not journalled).

## History
- [2026-10-15 18:39] (created) bug — Broker takeover: a daemon picking up a job half-applied by another daemon (old runtime to new, root to lane) must restore that job's own preimage/journal before running; today it loops 'dirty' because the only dirt is the job's own partial apply
- [2026-10-15 19:14] (comment) @claude: Done in 36f3047 (pushed). takeover.mjs: before running a job a daemon restores an unfinished journal naming it from any  (full comment #1 in ## Notes)
- [2026-10-15 19:14] (status) todo → review
