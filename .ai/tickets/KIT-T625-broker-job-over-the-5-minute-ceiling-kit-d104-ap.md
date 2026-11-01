---
id: KIT-T625
title: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 3.4 min of 7.6 min total; job j-mvju2wbq-7ipe2u (T-A), status
type: bug
status: review
priority: critical
asked: 24
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-22T17:55:24Z
updated: 2026-10-30T23:26:52Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 3.4 min of 7.6 min total; job j-mvju2wbq-7ipe2u (T-A), status landed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause: the broker test fixtures (repo 'app', jobs T-1/T-a/T-b/T-c; reported in claude-kit and 'broker') ran their pre-push gate and run commands through the REAL machine build slot (~/.claude/claude-kit-build-slots) and queued behind live cargo builds of other repos: 5-16 min of 'queued for the machine build slot', then filed real kit bugs. Fixed by bfc862b (KIT-T730): testkit.mjs gives every test process a private slot dir; test artifact scripts/broker/testkit-slots.test.mjs 2 passed, train-gate.test.mjs 3 passed in 46 s. No report after 2026-10-30 03:08, the fix landed 16:26. Reports filed before the fix stay as history.
Root cause: the broker's own fixture jobs ('app', T-1/T-A) took the real machine build slot in their pre-push gate (prepush.mjs acquireBuildSlot force) and queued behind live cargo builds, then reportOverrun filed the slow fixture run into the real kit store. Fixed in two parts: bfc862b (KIT-T730: testkit gives each test process a private slot dir) and 9db72be (testkit sets CLAUDE_KIT_NO_BUG_FILING; fileKitBug returns false under it, so a starved box can never file from a test). Evidence: testkit-slots.test.mjs 3, overrun 7, build-slot, gate: 24 passed. The last recurrence (2026-10-30 03:08) predates bfc862b.
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; cause was test fixtures on the real build slot, fixed by bfc862b (KIT-T730) and CLAUDE_KIT_NO_BUG_FILING (9db72be); no report since. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: none beyond publishing the runtime.
- Files: scripts/broker/testkit.mjs scripts/broker/testkit-slots.test.mjs

## History
- [2026-10-22 17:55] (created) bug — broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 3.4 min of 7.6 min total; job j-mvju2wbq-7ipe2u (T-A), status
- [2026-10-22 18:11] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 2.4 min of 6.3 min total; job j-mvjuh4fd-3ecdt8 (T-a), status landed; split, scope or speed up that phase
- [2026-10-22 18:11] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:11] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 2.4 min of 6.8 min total; job j-mvjuhdqo-zcot1v (T-b), status failed; split, scope or speed up that phase
- [2026-10-22 18:11] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:12] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 2.4 min of 8.7 min total; job j-mvjuhou0-4yjrjg (T-c), status landed; split, scope or speed up that phase
- [2026-10-22 18:12] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:12] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 2.3 min of 6.1 min total; job j-mvjum23i-kiaz4j (T-a), status landed; split, scope or speed up that phase
- [2026-10-22 18:12] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:12] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 2.4 min of 8.8 min total; job j-mvjui6xz-9buln4 (T-d), status landed; split, scope or speed up that phase
- [2026-10-22 18:12] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:12] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 2.3 min of 6.1 min total; job j-mvjumgsu-zi7suq (T-c), status landed; split, scope or speed up that phase
- [2026-10-22 18:12] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:22] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 1.8 min of 5.8 min total; job j-mvjv0mhl-18z8je (T-b), status failed; split, scope or speed up that phase
- [2026-10-22 18:22] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-22 18:22] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 1.8 min of 6.9 min total; job j-mvjv0rl7-shzuoc (T-c), status landed; split, scope or speed up that phase
- [2026-10-22 18:22] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:21] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 5.8 min of 5.9 min total, 5.7 min of it queued for the machine build slot; job j-mvsoa7ne-rh8mk9 (T-1), status landed; split, scope or speed up that phase
- [2026-10-28 22:21] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 18.9 min of 18.9 min total, 1.6 min of it queued for the machine build slot; job j-mvsokbly-x5l2ce (T-1), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 16.2 min of 16.3 min total, 16.2 min of it queued for the machine build slot; job j-mvson25n-7jiwhg (T-1), status passed; split, scope or speed up that phase
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 14.2 min of 14.2 min total; job j-mvsopso3-6izgb8 (T-1), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 16.4 min of 18.2 min total; job j-mvsoko4x-74mzex (T-A), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 12.4 min of 12.4 min total; job j-mvsos3id-kdrkdv (T-b), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app run phase took 18.9 min of 18.9 min total, 1.6 min of it queued for the machine build slot; job j-mvsokc2j-qm1jky (T-1), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:42] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 12.4 min of 12.4 min total; job j-mvsos3lf-r9z87w (T-c), status landed; split, scope or speed up that phase
- [2026-10-28 22:42] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:42] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 12.8 min of 13.2 min total; job j-mvsorkle-qc31lu (T-a), status landed; split, scope or speed up that phase
- [2026-10-28 22:42] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 22:42] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 12.8 min of 13.2 min total; job j-mvsorkvl-lwi0g4 (T-c), status landed; split, scope or speed up that phase
- [2026-10-28 22:42] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 23:23] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): app run phase took 7.7 min of 7.7 min total, 7.7 min of it queued for the machine build slot; job j-mvsqf7bq-rg78gc (T-1), status passed; split, scope or speed up that phase
- [2026-10-28 23:23] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-28 23:36] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): app run phase took 5.4 min of 5.4 min total, 5.4 min of it queued for the machine build slot; job j-mvsqyj5p-uewloq (T-1), status passed; split, scope or speed up that phase
- [2026-10-28 23:36] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-29 17:25] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 5.4 min of 5.5 min total; job j-mvtt63hu-gkt1xn (T-1), status landed; split, scope or speed up that phase
- [2026-10-29 17:25] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-30 03:08] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 6.6 min of 6.6 min total; job j-mvudymv3-0dpw3v (T-a), status landed; split, scope or speed up that phase
- [2026-10-30 03:08] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-30 03:08] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 6.6 min of 10.9 min total; job j-mvudt246-l7kf2x (T-c), status landed; split, scope or speed up that phase
- [2026-10-30 03:08] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-30 03:08] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): app pre-push gate phase took 6.6 min of 6.6 min total; job j-mvudyn6t-cw7pm0 (T-c), status landed; split, scope or speed up that phase
- [2026-10-30 03:08] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ap
- [2026-10-30 23:26] (status) todo → review
- [2026-10-30 23:28] (landed) 9db72be broker tests never file a real kit bug: the testkit sets CLAUDE_KIT_NO_BUG_FILING, so a fixture job slowed by a busy box
