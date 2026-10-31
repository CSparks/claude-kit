---
id: KIT-T742
title: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 13.8 min of 13.9 min total, 0.0 min of it queued for the machine
type: bug
status: review
priority: critical
asked: 5
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T23:43:17Z
updated: 2026-10-31T01:22:46Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 13.8 min of 13.9 min total, 0.0 min of it queued for the machine build slot; job j-mvvkfxhf-b2bzji (DE-T267), status failed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The published runtime has no scripts/broker/overrun.mjs, so no job is ticketed for exceeding a fixed 5 minutes (timing-tick.mjs measures waste by phase instead)

## Plan
1.

## Notes
Root cause: the fixed 5-minute per-job overrun filer (scripts/broker/overrun.mjs) still ran in the published runtime 773fb4a. It was removed at HEAD by KIT-D121 (e17b1a2, 262142e): timing is sampled by phase continuously and waste is ticketed by timing-tick.mjs, so no job is filed for being long. HEAD has no overrun.mjs and no 'over the 5-minute' text in scripts/ (q code check). Fixed by publishing the runtime at HEAD. Evidence: timing 20 passed (21c2099), runtime publish sha recorded in KIT-T747 Notes.
Published runtime 8a60480 (npm run publish:runtime; current -> 8a60480, no overrun.mjs). Stale 773fb4a was the cause; no code change needed. Residual measured waste (dirt-empire check->test rebuilds, build-slot queue) is KIT-D121 timing-tick's remit, KIT-T649.

## History
- [2026-10-30 23:43] (created) bug — broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 13.8 min of 13.9 min total, 0.0 min of it queued for the machine
- [2026-10-31 00:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.8 min total, 4.7 min of it queued for the machine build slot; commands ran 1.0 min; job train-j-mvvn45wh-ep0u83 (DE-T228 DE-T242), status passed; split, scope or speed up that phase
- [2026-10-31 00:19] (asked again) 2026-10-31 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-31 00:27] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.2 min of 8.3 min total, 5.5 min of it queued for the machine build slot; commands ran 2.7 min; job j-mvvn67g6-w4vgbr (DE-T267), status failed; split, scope or speed up that phase
- [2026-10-31 00:27] (asked again) 2026-10-31 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-31 00:34] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.2 min of 6.3 min total, 5.3 min of it queued for the machine build slot; commands ran 0.9 min; job j-mvvnf53g-9xsj1u (DE-T263), status passed; split, scope or speed up that phase
- [2026-10-31 00:34] (asked again) 2026-10-31 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-31 01:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.5 min of 6.6 min total, 4.1 min of it queued for the machine build slot; commands ran 2.3 min; job j-mvvpaam6-jw3eof (DE-T267), status failed; split, scope or speed up that phase
- [2026-10-31 01:14] (asked again) 2026-10-31 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-31 01:22] (landed) d2f8ead KIT-T742, KIT-T747: runtime 8a60480 published; the retired fixed-ceiling overrun filer no longer runs, so over-ceiling j
- [2026-10-31 01:22] (comment) criterion added: The published runtime has no scripts/broker/overrun.mjs, so no job is ticketed for exceeding a fixed 5 minutes (timing-tick.mjs measures waste by phase instead)
- [2026-10-31 01:22] (comment) ticked: The published runtime has no scripts/broker/overrun.mjs, so no job is ticketed for exceeding a fixed 5 minutes (timing-tick.mjs measures waste by phase instead)
- [2026-10-31 01:22] (status) todo → review
