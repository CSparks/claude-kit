---
id: KIT-T645
title: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.5 min of 9.9 min total, 0.0 min of it queued for the machine b
type: bug
status: review
priority: critical
asked: 126
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T03:26:55Z
updated: 2026-10-31T00:23:42Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.5 min of 9.9 min total, 0.0 min of it queued for the machine build slot; job j-mvq46meg-35ilra (DE-T175), status failed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Triage 2026-10-30 (125 reports, dirt-empire root lane; 49 results over 300 s read from target/broker/results): no single kit defect left. Split of command wall time: 5317 s compile, 3764 s test run, 4099 s queued for the machine build slot. Compile is the project's own: dirt-empire test commands build 17-32 crates in the optimized+debuginfo test profile (j-mvvhdz77: 346 of 356 s compile for one audio test), single GPU tests run 140-190 s (free_ride_drive_tour), and the patch worker re-runs the same heavy command per revision. Kit-side fixes already landed: adcd3a8 (KIT-T729, alias closure), 95cc7e1 (merged cargo test keeps the alias), 057c592 (one report per train, rounds and queue/command minutes named in the text). Queue accounting vs KIT-D105 is a maintainer decision: KIT-Q004. Left todo: per-project test scope has no kit lever. Tests: overrun.test.mjs 7 passed, alias-closure 3, coalesce-alias 3.
Root cause (dirt-empire results, 586 jobs): a red job's run phase carried an untimed second run. attribute.mjs re-runs each failed command on the pre-patch tree (tree restore, rebuild, filtered re-run, restore, rebuild) inside the 'run' phase and outside commands[].durationMs: 110 slow jobs with failed tests lost 13259 s of 44630 s of run time to it (j-mvvisw6a: run 952 s, commands 541 s incl. queue, 411 s unaccounted). Fix af1ffdb: the baseline is its own 'baseline' phase and is skipped once the job is past half the 5-minute ceiling (the failure stays unattributed, entry.unattributed names why, command-summary prints it). Evidence: scripts/broker/baseline-budget.test.mjs 4 passed; baseline/attribute/known-red/paired/train-*/deferred/takeover/crash-recovery 67 passed. Remainder is not the broker: the commands the workers submit (cargo t -p dirt-empire --test race/audio/bike: 100-500 s each, Bevy test-binary compile and link plus golden tests such as title_demo_laps 120-190 s) and machine build-slot queueing (D105). Scope those in the project (fewer binaries, narrower filters). KIT-T649's commit 057c592 reports queue vs command minutes per train.
Closed by KIT-D121 (262142e): the fixed 5-minute per-job overrun filer is removed, so these auto-filed reports stop. In its place every job is sampled by phase, crate and test with measured waste (timing-sample.mjs, timing-waste.mjs), ranked against the window before with a per-job trend (timing-profile.mjs), ticketed hourly as ranked time sinks waste-first with a comment when a rank moves or a sink leaves the top (timing-tick.mjs), and corrected by levers kept or reverted on measured turnaround (timing-correct.mjs; lever built: batch-window for slot queue). 'broker blockers --root <checkout>' prints the ranking. Tests: timing-sample 5, timing-profile 5, timing-tick 6; metrics/batch/train/land/baseline/usage/kit-bug 119 passed. First real read (dirt-empire, 24 h): only 50/380 root-lane and 21/151 rapid-game cargo commands compiled nothing; unneeded rebuilds led by rg-vehicle; the queue caused by that waste is the top estimated sink. Not built yet: levers for the waste itself (test re-scoping, warm-build reuse, job-level slot hold), and baseline.mjs still sizes its re-run budget from the old 5-minute constant (it skips a re-run, never a job).
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; fixed-ceiling filer replaced by continuous timing (KIT-D121) in 262142e, e17b1a2, 21c2099, all pushed. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: publish the runtime, then read: node scripts/broker/broker.mjs blockers --root D:\dev\dirt-empire; answer KIT-Q005 (waste levers).
- Files: scripts/broker/timing-sample.mjs timing-waste.mjs timing-profile.mjs timing-tick.mjs timing-correct.mjs timing-tuning.mjs timing-moved.mjs timing-report.mjs

## History
- [2026-10-27 03:26] (created) bug — broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.5 min of 9.9 min total, 0.0 min of it queued for the machine b
- [2026-10-27 16:23] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.5 min of 5.5 min total, 0.0 min of it queued for the machine build slot; job j-mvqvzzwz-knh11f (DE-T183), status passed; split, scope or speed up that phase
- [2026-10-27 16:23] (asked again) 2026-10-27 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 03:00] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.3 min of 6.3 min total, 0.0 min of it queued for the machine build slot; job j-mvrisi4i-rxazmg (DE-T184), status failed; split, scope or speed up that phase
- [2026-10-28 03:00] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 03:26] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 7.5 min total, 0.0 min of it queued for the machine build slot; job j-mvrjnsts-dag4nu (DE-T184), status failed; split, scope or speed up that phase
- [2026-10-28 03:26] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 03:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.1 min of 9.3 min total, 0.0 min of it queued for the machine build slot; job j-mvrk3ksm-57501w (DE-T184), status landed; split, scope or speed up that phase
- [2026-10-28 03:55] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 04:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 19.2 min of 19.2 min total, 0.0 min of it queued for the machine build slot; job j-mvrmf7jb-98n6vj (DE-T184), status passed; split, scope or speed up that phase
- [2026-10-28 04:55] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 05:07] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.7 min of 6.7 min total, 0.0 min of it queued for the machine build slot; job j-mvrmhw8n-frf097 (DE-T188), status passed; split, scope or speed up that phase
- [2026-10-28 05:07] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 05:17] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire commit phase took 4.7 min of 8.5 min total, 0.0 min of it queued for the machine build slot; job j-mvrn4bqf-g8h145 (DE-T184), status landed; split, scope or speed up that phase
- [2026-10-28 05:17] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 05:28] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.0 min of 11.2 min total, 0.0 min of it queued for the machine build slot; job j-mvrna1zb-hf9ryi (DE-T188), status failed; split, scope or speed up that phase
- [2026-10-28 05:28] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 05:41] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.3 min of 6.4 min total, 0.0 min of it queued for the machine build slot; job j-mvrog6pg-skcwul (DE-T188), status passed; split, scope or speed up that phase
- [2026-10-28 05:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 06:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 18.1 min of 18.4 min total, 0.0 min of it queued for the machine build slot; job j-mvrph4vm-11alv3 (DE-T188), status failed; split, scope or speed up that phase
- [2026-10-28 06:19] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 06:31] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.2 min of 11.4 min total, 0.0 min of it queued for the machine build slot; job j-mvrq6529-xnge17 (DE-T188), status passed; split, scope or speed up that phase
- [2026-10-28 06:31] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 06:39] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.7 min of 5.2 min total, 0.0 min of it queued for the machine build slot; job j-mvrqo2sc-2yf1j0 (DE-T188), status landed; split, scope or speed up that phase
- [2026-10-28 06:39] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 07:01] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.1 min of 9.4 min total, 0.0 min of it queued for the machine build slot; job j-mvrrbdzl-kqmqww (DE-T188), status landed; split, scope or speed up that phase
- [2026-10-28 07:01] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 07:15] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 13.4 min of 13.7 min total, 0.0 min of it queued for the machine build slot; job j-mvrrbi2x-mrknou (DE-T188), status failed; split, scope or speed up that phase
- [2026-10-28 07:15] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 18:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.2 min of 5.3 min total, 0.0 min of it queued for the machine build slot; job j-mvsfhjzg-g3eke5 (DE-T189), status failed; split, scope or speed up that phase
- [2026-10-28 18:14] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 19:53] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.8 min of 5.0 min total, 0.0 min of it queued for the machine build slot; job j-mvsiil6x-no8rjd (DE-T195), status passed; split, scope or speed up that phase
- [2026-10-28 19:53] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 21:11] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 34.3 min of 34.6 min total, 0.0 min of it queued for the machine build slot; job j-mvskowvb-iinf3d (DE-T196), status failed; split, scope or speed up that phase
- [2026-10-28 21:11] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 22:20] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 6.1 min total, 0.0 min of it queued for the machine build slot; job j-mvsnwzw7-faem7z (DE-T206), status landed; split, scope or speed up that phase
- [2026-10-28 22:20] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 22:41] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 18.4 min of 19.0 min total, 0.2 min of it queued for the machine build slot; job j-mvso1qpw-fsuedf (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-28 22:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 23:02] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 20.5 min of 20.7 min total, 0.0 min of it queued for the machine build slot; job j-mvsojw1m-h5favu (DE-T200), status failed; split, scope or speed up that phase
- [2026-10-28 23:02] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 23:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.8 min of 11.8 min total, 0.7 min of it queued for the machine build slot; job j-mvsokz1z-55hi1f (DE-T199), status passed; split, scope or speed up that phase
- [2026-10-28 23:14] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 23:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.8 min of 11.9 min total, 0.7 min of it queued for the machine build slot; job j-mvspg6cq-3rmnpo (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-28 23:14] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-28 23:36] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.7 min of 9.8 min total, 0.0 min of it queued for the machine build slot; job j-mvspzw58-rjpqfd (DE-T200), status failed; split, scope or speed up that phase
- [2026-10-28 23:36] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 00:03] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 23.9 min of 26.6 min total, 0.9 min of it queued for the machine build slot; job j-mvsq5bl3-q99l6e (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-29 00:03] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 00:03] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 23.9 min of 26.6 min total, 0.9 min of it queued for the machine build slot; job j-mvsqft8i-3a26de (DE-T199), status landed; split, scope or speed up that phase
- [2026-10-29 00:03] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 00:17] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 12.1 min of 12.5 min total, 1.0 min of it queued for the machine build slot; job j-mvsqrnqt-n1bf0l (DE-T207), status passed; split, scope or speed up that phase
- [2026-10-29 00:17] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 00:38] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.8 min of 6.8 min total, 0.0 min of it queued for the machine build slot; job j-mvst62kd-uwk779 (DE-T208), status passed; split, scope or speed up that phase
- [2026-10-29 00:38] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:34] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.5 min of 6.5 min total, 0.0 min of it queued for the machine build slot; job j-mvsux1f0-rn55iq (DE-T214), status failed; split, scope or speed up that phase
- [2026-10-29 01:34] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:34] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.6 min of 11.1 min total, 0.0 min of it queued for the machine build slot; job j-mvsuw0ib-vfmhl3 (DE-T211), status passed; split, scope or speed up that phase
- [2026-10-29 01:34] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:34] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.6 min of 11.1 min total, 0.0 min of it queued for the machine build slot; job j-mvsuwarc-67sp88 (DE-T205), status passed; split, scope or speed up that phase
- [2026-10-29 01:34] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:42] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvsvbe9t-0qiitj (DE-T214), status landed; split, scope or speed up that phase
- [2026-10-29 01:42] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:42] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvsvf7wc-nep1fm (DE-T205), status landed; split, scope or speed up that phase
- [2026-10-29 01:42] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 01:42] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvsvfzi3-pfwfzo (DE-T211), status landed; split, scope or speed up that phase
- [2026-10-29 01:42] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 02:30] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.7 min of 9.7 min total, 0.0 min of it queued for the machine build slot; job j-mvswsh7k-2s6u1n (DE-T215), status passed; split, scope or speed up that phase
- [2026-10-29 02:30] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 03:00] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 12.4 min of 12.6 min total, 0.0 min of it queued for the machine build slot; job j-mvsxwr8t-5zk0y8 (DE-T216), status passed; split, scope or speed up that phase
- [2026-10-29 03:00] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 03:33] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.1 min of 7.2 min total, 0.0 min of it queued for the machine build slot; job j-mvszec69-2qp0d6 (DE-T216), status failed; split, scope or speed up that phase
- [2026-10-29 03:33] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:04] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.1 min of 10.1 min total, 0.0 min of it queued for the machine build slot; job j-mvt0ahi1-oa2br2 (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-29 04:04] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.7 min of 5.7 min total, 0.0 min of it queued for the machine build slot; job j-mvt0e4nx-cjyvb8 (DE-T214), status passed; split, scope or speed up that phase
- [2026-10-29 04:13] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:28] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.3 min of 5.6 min total, 0.0 min of it queued for the machine build slot; job j-mvt1b8ix-iucdn2 (DE-T216), status failed; split, scope or speed up that phase
- [2026-10-29 04:28] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:39] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.2 min of 8.3 min total, 0.0 min of it queued for the machine build slot; job j-mvt1p84r-1gt59h (DE-T216), status failed; split, scope or speed up that phase
- [2026-10-29 04:39] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:46] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.5 min of 5.6 min total, 0.0 min of it queued for the machine build slot; job j-mvt22no1-gvywez (DE-T216), status failed; split, scope or speed up that phase
- [2026-10-29 04:46] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 04:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.8 min of 5.0 min total, 0.0 min of it queued for the machine build slot; job j-mvt2dgjc-r4k603 (DE-T216), status landed; split, scope or speed up that phase
- [2026-10-29 04:55] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 05:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.0 min of 7.1 min total, 0.0 min of it queued for the machine build slot; job j-mvt2mlv3-7w99oq (DE-T217), status passed; split, scope or speed up that phase
- [2026-10-29 05:05] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 05:52] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.0 min of 5.1 min total, 0.0 min of it queued for the machine build slot; job j-mvt4frs6-zxjulb (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 05:52] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 14:47] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.3 min of 6.4 min total, 0.0 min of it queued for the machine build slot; job j-mvtni7kl-ipjqwn (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 14:47] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 14:54] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvtns65p-bsnum6 (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-29 14:54] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 15:38] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.6 min of 9.8 min total, 0.0 min of it queued for the machine build slot; job j-mvtp7j5n-m5lrlk (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 15:38] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 15:45] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 3.1 min of 5.3 min total, 0.0 min of it queued for the machine build slot; job j-mvtphtc3-pekxtl (DE-T220), status failed; split, scope or speed up that phase
- [2026-10-29 15:45] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 15:45] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 3.1 min of 6.4 min total, 0.0 min of it queued for the machine build slot; job j-mvtpkmv9-etmnq0 (DE-T209), status landed; split, scope or speed up that phase
- [2026-10-29 15:45] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 16:15] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.8 min of 6.5 min total, 0.0 min of it queued for the machine build slot; job j-mvtqit5m-yyk0ou (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-29 16:15] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 16:30] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.1 min of 6.1 min total, 0.0 min of it queued for the machine build slot; job j-mvtqzah8-2j2jvv (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 16:30] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 16:30] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.1 min of 6.2 min total, 0.0 min of it queued for the machine build slot; job j-mvtqz6c1-xogof6 (DE-T220), status landed; split, scope or speed up that phase
- [2026-10-29 16:30] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 16:58] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 22.1 min of 22.2 min total, 10.1 min of it queued for the machine build slot; job j-mvtri2jn-q63bnb (DE-T219), status passed; split, scope or speed up that phase
- [2026-10-29 16:58] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.1 min of 7.2 min total, 5.6 min of it queued for the machine build slot; job j-mvtrjfhx-tb03p2 (DE-T208), status failed; split, scope or speed up that phase
- [2026-10-29 17:05] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:25] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.1 min of 9.1 min total, 0.4 min of it queued for the machine build slot; job j-mvtrwpak-vlvb0n (DE-T227), status failed; split, scope or speed up that phase
- [2026-10-29 17:25] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:25] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.3 min of 9.6 min total, 0.0 min of it queued for the machine build slot; job j-mvtt0rtz-v0fa4c (DE-T194), status passed; split, scope or speed up that phase
- [2026-10-29 17:25] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:40] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.9 min of 7.0 min total, 0.0 min of it queued for the machine build slot; job j-mvtsff2d-zi9awe (DE-T219), status failed; split, scope or speed up that phase
- [2026-10-29 17:40] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.1 min of 7.1 min total, 0.0 min of it queued for the machine build slot; job j-mvtsrmo3-9dlo11 (DE-T224), status failed; split, scope or speed up that phase
- [2026-10-29 17:55] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 10.2 min total, 0.0 min of it queued for the machine build slot; job j-mvttfo47-p49n4p (DE-T194), status failed; split, scope or speed up that phase
- [2026-10-29 17:55] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 17:55] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 13.4 min total, 0.0 min of it queued for the machine build slot; job j-mvttxrpq-pgt12g (DE-T227), status failed; split, scope or speed up that phase
- [2026-10-29 17:55] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 18:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.0 min of 6.0 min total, 0.0 min of it queued for the machine build slot; job j-mvtuc75l-1vpusi (DE-T224), status failed; split, scope or speed up that phase
- [2026-10-29 18:19] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 18:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.9 min of 13.0 min total, 0.0 min of it queued for the machine build slot; job j-mvtuhnw8-n5fwx4 (DE-T227), status failed; split, scope or speed up that phase
- [2026-10-29 18:19] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 18:34] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 12.9 min of 13.1 min total, 1.5 min of it queued for the machine build slot; job j-mvtug0t8-o6r9bz (DE-T194), status failed; split, scope or speed up that phase
- [2026-10-29 18:34] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 19:03] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.1 min of 7.2 min total, 0.6 min of it queued for the machine build slot; job j-mvtwgkcb-fmsjjp (DE-T227), status failed; split, scope or speed up that phase
- [2026-10-29 19:03] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 19:51] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 12.0 min of 12.3 min total, 0.0 min of it queued for the machine build slot; job j-mvty2rlw-2yxpyr (DE-T194), status failed; split, scope or speed up that phase
- [2026-10-29 19:51] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 20:01] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.1 min of 10.1 min total, 0.0 min of it queued for the machine build slot; job j-mvty8ysr-448924 (DE-T224), status failed; split, scope or speed up that phase
- [2026-10-29 20:01] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 20:01] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.1 min of 10.1 min total, 0.0 min of it queued for the machine build slot; job j-mvtyg88k-z6f7xj (DE-T231), status failed; split, scope or speed up that phase
- [2026-10-29 20:01] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 20:10] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.1 min of 8.2 min total, 0.0 min of it queued for the machine build slot; job j-mvtyht11-8vcrr2 (DE-T225), status passed; split, scope or speed up that phase
- [2026-10-29 20:10] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 20:50] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.1 min of 9.2 min total, 0.0 min of it queued for the machine build slot; job j-mvu0c3p5-o8ec05 (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 20:50] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 21:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.0 min of 5.1 min total, 0.8 min of it queued for the machine build slot; job j-mvu106b2-jf3arf (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-29 21:05] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 21:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.6 min of 5.8 min total, 0.0 min of it queued for the machine build slot; job j-mvu1hdbp-khwdhd (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-29 21:19] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 21:47] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.2 min of 9.3 min total, 8.7 min of it queued for the machine build slot; job j-mvu2514k-vjbo5r (KIT-T620), status landed; split, scope or speed up that phase
- [2026-10-29 21:47] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 22:00] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.4 min of 6.6 min total, 0.0 min of it queued for the machine build slot; job j-mvu24980-9xae94 (DE-T231), status landed; split, scope or speed up that phase
- [2026-10-29 22:00] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 22:26] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.2 min of 5.2 min total, 1.8 min of it queued for the machine build slot; job j-mvu3yiah-bfkiej (DE-T232), status passed; split, scope or speed up that phase
- [2026-10-29 22:26] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-29 22:59] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 7.6 min total, 4.4 min of it queued for the machine build slot; job j-mvu50gtv-8w7aqh (DE-T234), status passed; split, scope or speed up that phase
- [2026-10-29 22:59] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 00:16] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.1 min of 9.5 min total, 0.0 min of it queued for the machine build slot; job j-mvu7oxlo-4njxnw (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-30 00:16] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 00:33] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.0 min of 10.0 min total, 0.0 min of it queued for the machine build slot; job j-mvu86027-aw5od6 (DE-T209), status failed; split, scope or speed up that phase
- [2026-10-30 00:33] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 00:40] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.1 min of 6.2 min total, 1.5 min of it queued for the machine build slot; job j-mvu8ai9k-czi9pf (DE-T239), status failed; split, scope or speed up that phase
- [2026-10-30 00:40] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 00:52] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 8.1 min total, 2.8 min of it queued for the machine build slot; job j-mvu8sp6n-hiupnq (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-30 00:52] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 01:06] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.9 min of 8.9 min total, 0.0 min of it queued for the machine build slot; job j-mvu8u94o-3uslfd (DE-T209), status passed; split, scope or speed up that phase
- [2026-10-30 01:06] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 01:06] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 9.0 min of 9.0 min total, 0.0 min of it queued for the machine build slot; job j-mvu92g0q-o9q329 (DE-T239), status landed; split, scope or speed up that phase
- [2026-10-30 01:06] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 01:39] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.5 min of 6.6 min total, 0.0 min of it queued for the machine build slot; job j-mvuajys5-9nro6k (DE-T239), status failed; split, scope or speed up that phase
- [2026-10-30 01:39] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 01:51] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.3 min of 8.4 min total, 1.2 min of it queued for the machine build slot; job j-mvub4pub-3vyk67 (DE-T239), status failed; split, scope or speed up that phase
- [2026-10-30 01:51] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 02:07] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.2 min of 8.4 min total, 0.3 min of it queued for the machine build slot; job j-mvubmqlr-7uoplo (DE-T239), status failed; split, scope or speed up that phase
- [2026-10-30 02:07] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 02:30] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.8 min of 8.0 min total, 2.2 min of it queued for the machine build slot; job j-mvubt27v-2io642 (DE-T239), status passed; split, scope or speed up that phase
- [2026-10-30 02:30] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 02:39] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.8 min of 6.8 min total, 0.8 min of it queued for the machine build slot; job j-mvuch1vb-t6uato (DE-T234), status passed; split, scope or speed up that phase
- [2026-10-30 02:39] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 02:39] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.8 min of 6.9 min total, 0.8 min of it queued for the machine build slot; job j-mvucdaqd-alwpqs (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-30 02:39] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.1 min of 5.1 min total, 0.1 min of it queued for the machine build slot; job j-mvud2ico-opsgwa (DE-T224), status failed; split, scope or speed up that phase
- [2026-10-30 03:13] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.8 min of 16.4 min total, 5.6 min of it queued for the machine build slot; job j-mvud6rbo-jh1wvm (DE-T234), status landed; split, scope or speed up that phase
- [2026-10-30 03:13] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.8 min of 16.4 min total, 5.6 min of it queued for the machine build slot; job j-mvud9lri-l5jpei (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-30 03:13] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.8 min of 16.4 min total, 5.6 min of it queued for the machine build slot; job j-mvudee85-zrdmiv (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-30 03:13] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:24] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.6 min of 7.7 min total, 5.0 min of it queued for the machine build slot; job j-mvud707g-6eie18 (DE-T208), status passed; split, scope or speed up that phase
- [2026-10-30 03:24] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 03:32] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.7 min of 7.8 min total, 0.5 min of it queued for the machine build slot; job j-mvud7z1m-nllcck (DE-T225), status passed; split, scope or speed up that phase
- [2026-10-30 03:32] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:04] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.4 min of 11.4 min total, 3.8 min of it queued for the machine build slot; job j-mvugiqdn-duuykv (DE-T242), status passed; split, scope or speed up that phase
- [2026-10-30 06:04] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:04] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.4 min of 11.4 min total, 3.8 min of it queued for the machine build slot; job j-mvuglhm7-lxee6c (DE-T208), status passed; split, scope or speed up that phase
- [2026-10-30 06:04] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:04] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.4 min of 11.5 min total, 3.8 min of it queued for the machine build slot; job j-mvuh4iim-lwrimk (DE-T224), status landed; split, scope or speed up that phase
- [2026-10-30 06:04] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.0 min of 5.1 min total, 0.7 min of it queued for the machine build slot; job j-mvuk3zpg-1yskmi (DE-T228), status failed; split, scope or speed up that phase
- [2026-10-30 06:13] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:31] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvukjlea-yep8rt (DE-T242), status landed; split, scope or speed up that phase
- [2026-10-30 06:31] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:31] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvukjn5g-ir5grr (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-30 06:31] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 06:45] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.5 min of 5.7 min total, 1.4 min of it queued for the machine build slot; job j-mvukxcgc-ktg640 (DE-T228), status failed; split, scope or speed up that phase
- [2026-10-30 06:45] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 07:07] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 16.6 min of 16.7 min total, 2.0 min of it queued for the machine build slot; job j-mvulngi3-gpiabi (DE-T226), status passed; split, scope or speed up that phase
- [2026-10-30 07:07] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 07:18] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.6 min of 5.8 min total, 0.0 min of it queued for the machine build slot; job j-mvumjzcr-qo35r8 (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 07:18] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 07:40] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.0 min of 5.7 min total, 0.6 min of it queued for the machine build slot; job j-mvunndg8-qyupc7 (DE-T254), status landed; split, scope or speed up that phase
- [2026-10-30 07:40] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 08:16] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.9 min of 8.0 min total, 0.0 min of it queued for the machine build slot; job j-mvuopa4z-a4tqp5 (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 08:16] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 08:24] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.8 min of 7.1 min total, 0.0 min of it queued for the machine build slot; job j-mvup1ihq-0brn8y (DE-T254), status failed; split, scope or speed up that phase
- [2026-10-30 08:24] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 08:24] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 4.8 min of 8.5 min total, 0.0 min of it queued for the machine build slot; job j-mvuoz8wd-07u45w (DE-T226), status landed; split, scope or speed up that phase
- [2026-10-30 08:24] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 09:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.4 min of 8.6 min total, 0.0 min of it queued for the machine build slot; job j-mvur27qr-h29gpd (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 09:19] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 14:45] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 11.5 min of 12.0 min total, 2.6 min of it queued for the machine build slot; job j-mvv2m5tt-4kxj46 (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 14:45] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 16:24] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.5 min of 7.9 min total, 0.4 min of it queued for the machine build slot; job j-mvv63xy7-5z6axp (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 16:24] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 16:35] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.1 min of 6.5 min total, 0.0 min of it queued for the machine build slot; job j-mvv6q61c-mehcxg (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 16:35] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 16:57] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.0 min of 6.3 min total, 0.1 min of it queued for the machine build slot; job j-mvv7iw80-447rr6 (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 16:57] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 17:18] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.9 min of 6.3 min total, 0.3 min of it queued for the machine build slot; job j-mvv8au91-yaz57m (DE-T244), status failed; split, scope or speed up that phase
- [2026-10-30 17:18] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 17:53] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 5.8 min of 5.9 min total, 0.0 min of it queued for the machine build slot; job j-mvv9jyd7-y1ji75 (DE-T254), status passed; split, scope or speed up that phase
- [2026-10-30 17:53] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 19:46] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.7 min of 8.0 min total, 0.4 min of it queued for the machine build slot; job j-mvvd5pih-ujxa92 (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 19:46] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 20:08] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 12.3 min of 12.9 min total, 3.2 min of it queued for the machine build slot; job j-mvve1f21-ytpqm5 (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 20:08] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 20:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.9 min of 6.9 min total, 0.0 min of it queued for the machine build slot; job j-mvve7pwo-bhzoz7 (DE-T264), status failed; split, scope or speed up that phase
- [2026-10-30 20:19] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 20:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 7.0 min of 7.6 min total, 0.0 min of it queued for the machine build slot; job j-mvve55or-j19nig (MAR-T034), status passed; split, scope or speed up that phase
- [2026-10-30 20:19] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 20:30] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 6.3 min of 6.3 min total, 0.0 min of it queued for the machine build slot; job j-mvvf3eot-rirk75 (DE-T264), status failed; split, scope or speed up that phase
- [2026-10-30 20:30] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 21:15] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 24.8 min of 25.3 min total, 2.9 min of it queued for the machine build slot; job j-mvvg3ebj-ejwjfa (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 21:15] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 21:43] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 10.3 min of 10.5 min total, 0.0 min of it queued for the machine build slot; job j-mvvhdz77-09ippr (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 21:43] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 22:07] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 23.3 min of 23.8 min total, 1.4 min of it queued for the machine build slot; job j-mvvhvcxz-sa8uf9 (DE-T267), status failed; split, scope or speed up that phase
- [2026-10-30 22:07] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 22:22] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.2 min of 8.7 min total, 0.0 min of it queued for the machine build slot; job j-mvvi3pqb-yfwupl (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 22:22] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 22:38] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 15.9 min of 16.0 min total, 1.8 min of it queued for the machine build slot; job j-mvvisw6a-ojjy9y (DE-T267), status failed; split, scope or speed up that phase
- [2026-10-30 22:38] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 22:48] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.9 min of 9.0 min total, 6.9 min of it queued for the machine build slot; job j-mvvjiwh5-vhuj1l (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 22:48] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 23:25] (landed) af1ffdb broker: the attribution baseline is its own phase and is skipped past half the 5-minute ceiling, so a red job no longer 
- [2026-10-30 23:29] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): dirt-empire run phase took 8.3 min of 8.5 min total, 0.0 min of it queued for the machine build slot; job j-mvvkdjkw-wo1p8f (DE-T263), status failed; split, scope or speed up that phase
- [2026-10-30 23:29] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-di
- [2026-10-30 23:36] (status) todo → review
- [2026-10-31 00:23] (status) review → review
