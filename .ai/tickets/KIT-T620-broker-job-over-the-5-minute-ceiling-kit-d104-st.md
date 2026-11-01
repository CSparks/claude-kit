---
id: KIT-T620
title: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 14.3 min of 14.5 min total; job j-mvjn8xwi-1q2ri5 (ST-T926), status
type: bug
status: review
priority: critical
asked: 19
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-22T14:52:10Z
updated: 2026-10-30T23:26:54Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 14.3 min of 14.5 min total; job j-mvjn8xwi-1q2ri5 (ST-T926), status failed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause chain: stiletto run phase 5-56 min (2026-10-22/23) was a full per-landing suite and a coalesced cargo test spanning other packages' --lib; fixed by 346d1db (coalesce.test.mjs: commands merge only as a package-by-selector product) and 924dc11 (precheck-guards.test.mjs: markdown-only patch skips the cargo check), with D110 tiering (7b8687f). No stiletto-repo report since 2026-10-23; the 2026-10-28/29 'stiletto' reports came from claude-kit test fixtures (RG-T1) queued on the real build slot, fixed by bfc862b (KIT-T730, testkit-slots.test.mjs 2 passed). Overrun report text now splits queue from command minutes (057c592, overrun.test.mjs 7 passed).
Recurrences since the earlier fixes (346d1db, 924dc11, 9efd67f) are queue-bound: the last two (10-28 22:41, 10-29 04:13) show 13.7 and 5.7 min of the run phase queued for the machine build slot (D105), with the job's own work near zero. Own-time fix for red jobs is af1ffdb (untimed attribution re-run now its own phase, skipped past half the ceiling). No stiletto result files remain on this box to re-measure. Open item for the maintainer: slot queueing is the D105 trade (one build per machine) and cannot be shortened by the broker; say if overrun filing should ignore queue-only minutes.
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; stiletto causes fixed by 346d1db and 924dc11; later reports were the test-fixture leak. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: none beyond publishing the runtime.
- Files: scripts/broker/coalesce.test.mjs scripts/broker/precheck-guards.test.mjs

## History
- [2026-10-22 14:52] (created) bug — broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 14.3 min of 14.5 min total; job j-mvjn8xwi-1q2ri5 (ST-T926), status
- [2026-10-22 15:38] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 31.1 min of 31.6 min total; job j-mvjobhgw-iw9ag1 (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 15:38] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 15:52] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 12.2 min of 12.8 min total; job j-mvjp18yc-qfl3yi (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 15:52] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 16:54] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 53.3 min of 53.8 min total; job j-mvjq8coo-o1g4xm (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 16:54] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 17:09] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 8.6 min of 11.5 min total; job j-mvjs6vpr-ucgy1s (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 17:09] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 17:32] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 14.6 min of 15.2 min total; job j-mvjsv5x6-f3xhum (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 17:32] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 17:40] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto gate phase took 2.3 min of 6.5 min total; job j-mvjthky4-gobdhz (ST-T926), status landed; split, scope or speed up that phase
- [2026-10-22 17:40] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 17:55] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 3.4 min of 7.4 min total, 3.2 min of it queued for the machine build slot; job j-mvju304w-60sm2h (RG-T1), status landed; split, scope or speed up that phase
- [2026-10-22 17:55] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 18:35] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 49.5 min of 51.8 min total; job j-mvjtv37h-6yw8m3 (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 18:35] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 19:05] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 24.3 min of 24.4 min total; job j-mvjvynwd-xc02bq (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 19:05] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 19:42] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 5.2 min of 5.9 min total; job j-mvjxxe7b-vrvmv9 (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 19:42] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 20:08] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 20.7 min of 21.1 min total; job j-mvjybslb-rh2hls (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 20:08] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 20:28] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 7.0 min of 8.3 min total; job j-mvjzgei0-5kl46x (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 20:28] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 21:01] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 10.2 min of 11.1 min total; job j-mvk0ko13-ktpibf (ST-T926), status failed; split, scope or speed up that phase
- [2026-10-22 21:01] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 21:19] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 7.4 min of 8.3 min total; job j-mvk1axgo-n56cf8 (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 21:19] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-22 22:19] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 56.4 min of 56.9 min total; job j-mvk1q7hz-5ka2jz (ST-T926), status passed; split, scope or speed up that phase
- [2026-10-22 22:19] (asked again) 2026-10-22 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-23 00:37] (comment) seen again in stiletto-2349: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 13.8 min of 14.4 min total, 0.0 min of it queued for the machine build slot; job j-mvk86sy5-0fu5d9 (ST-T956), status failed; split, scope or speed up that phase
- [2026-10-23 00:37] (asked again) 2026-10-23 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-28 22:41] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 13.7 min of 13.8 min total, 13.7 min of it queued for the machine build slot; job j-mvsoqbgh-6b17le (RG-T1), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-29 04:13] (comment) seen again in broker: broker job over the 5-minute ceiling (KIT-D104): stiletto run phase took 5.7 min of 5.7 min total, 5.7 min of it queued for the machine build slot; job j-mvt0vmu3-vp1bqu (RG-T1), status landed; split, scope or speed up that phase
- [2026-10-29 04:13] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-st
- [2026-10-29 21:06] (landed) 346d1db coalesce: commands merge only as a package-by-selector product, so one package's --lib never reaches another (implements
- [2026-10-29 21:21] (landed) 924dc11 precheck: a markdown-only patch skips the cargo check (implements KIT-T620)
- [2026-10-30 23:26] (status) todo → review
