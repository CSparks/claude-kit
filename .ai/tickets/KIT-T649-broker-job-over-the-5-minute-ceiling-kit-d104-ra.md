---
id: KIT-T649
title: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.2 min of 6.2 min total, 0.0 min of it queued for the machine bu
type: bug
status: review
priority: critical
asked: 48
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T14:46:05Z
updated: 2026-10-31T00:23:44Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.2 min of 6.2 min total, 0.0 min of it queued for the machine build slot; job j-mvqskwwg-crndjp (DE-T183), status failed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Triage 2026-10-30: rapid-game lane, 22 results over 300 s: 2369 s compile, 5169 s queued of 6421 s (80%). Kit defects found and fixed: 95cc7e1 + adcd3a8 (KIT-T729: second feature-set Bevy rebuild, --workspace behind an unreachable --features), 057c592 (a train's members each filed their own bug for the shared run, e.g. j-mvvj5a05/j-mvvjg437 one minute apart; a retried run phase showed only its largest round; now one report per train, rounds and queue/command minutes in the text; overrun.test.mjs 7 passed). The rest is queueing behind dirt-empire root-lane jobs (one slot machine-wide, KIT-D105) plus one inherent workspace rebuild per feature-graph change; policy question KIT-Q004. Left todo until the maintainer answers it.
Same root cause as KIT-T645 (rapid-game jobs run from dirt-empire sessions share the broker): untimed attribution re-run in the run phase, fixed af1ffdb (own 'baseline' phase, skipped past half the ceiling; baseline-budget 4 passed, 67 in the neighbouring modules). Report side: 057c592 (overrun 7, train/batch 40 passed). The remaining run time is the submitted commands plus slot queueing (j-mvvj5a05: 14.2 of 25.2 min queued), not broker work.
Closed by KIT-D121 (262142e): the fixed 5-minute per-job overrun filer is removed, so these auto-filed reports stop. In its place every job is sampled by phase, crate and test with measured waste (timing-sample.mjs, timing-waste.mjs), ranked against the window before with a per-job trend (timing-profile.mjs), ticketed hourly as ranked time sinks waste-first with a comment when a rank moves or a sink leaves the top (timing-tick.mjs), and corrected by levers kept or reverted on measured turnaround (timing-correct.mjs; lever built: batch-window for slot queue). 'broker blockers --root <checkout>' prints the ranking. Tests: timing-sample 5, timing-profile 5, timing-tick 6; metrics/batch/train/land/baseline/usage/kit-bug 119 passed. First real read (dirt-empire, 24 h): only 50/380 root-lane and 21/151 rapid-game cargo commands compiled nothing; unneeded rebuilds led by rg-vehicle; the queue caused by that waste is the top estimated sink. Not built yet: levers for the waste itself (test re-scoping, warm-build reuse, job-level slot hold), and baseline.mjs still sizes its re-run budget from the old 5-minute constant (it skips a re-run, never a job).
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; same work as KIT-T645 (one report per train 057c592, then KIT-D121 timing). Levers 1-3 not built: cause measured, check->test with different flags is the largest (21c2099), decision wanted in KIT-Q005. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: publish; answer KIT-Q005; then lever (1) feature-set normalisation if chosen.
- Files: scripts/broker/timing-waste.mjs scripts/broker/timing-correct.mjs .ai/questions/KIT-Q005-*.md

## History
- [2026-10-27 14:46] (created) bug — broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.2 min of 6.2 min total, 0.0 min of it queued for the machine bu
- [2026-10-27 15:37] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.0 min of 6.1 min total, 0.0 min of it queued for the machine build slot; job j-mvqufltx-3g4u7a (DE-T183), status failed; split, scope or speed up that phase
- [2026-10-27 15:37] (asked again) 2026-10-27 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-27 16:11] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.2 min of 7.3 min total, 0.0 min of it queued for the machine build slot; job j-mvqvl0m6-c791hg (DE-T183), status failed; split, scope or speed up that phase
- [2026-10-27 16:11] (asked again) 2026-10-27 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 03:13] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.1 min of 7.2 min total, 0.0 min of it queued for the machine build slot; job j-mvrj8e7s-g37r2b (DE-T184), status passed; split, scope or speed up that phase
- [2026-10-28 03:13] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 03:41] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 11.5 min of 11.8 min total, 0.0 min of it queued for the machine build slot; job j-mvrk1rid-xc88yq (DE-T187), status landed; split, scope or speed up that phase
- [2026-10-28 03:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 04:08] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.7 min of 6.8 min total, 0.0 min of it queued for the machine build slot; job j-mvrl7kf1-sv8ae8 (DE-T184), status passed; split, scope or speed up that phase
- [2026-10-28 04:08] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 04:19] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 5.8 min of 5.8 min total, 0.0 min of it queued for the machine build slot; job j-mvrll2da-4t0zef (DE-T188), status passed; split, scope or speed up that phase
- [2026-10-28 04:19] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 06:52] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 10.5 min of 12.2 min total, 0.0 min of it queued for the machine build slot; job j-mvrqvk76-7jtz6m (DE-T188), status landed; split, scope or speed up that phase
- [2026-10-28 06:52] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 08:41] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.1 min of 6.6 min total, 0.0 min of it queued for the machine build slot; job j-mvruyy5j-9o3rd1 (DE-T188), status landed; split, scope or speed up that phase
- [2026-10-28 08:41] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 17:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 5.1 min of 5.2 min total, 0.0 min of it queued for the machine build slot; job j-mvsddbyn-n9c0bn (DE-T192), status passed; split, scope or speed up that phase
- [2026-10-28 17:14] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 17:35] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 8.3 min of 8.4 min total, 0.0 min of it queued for the machine build slot; job j-mvsdzlpk-lxomj8 (DE-T181), status passed; split, scope or speed up that phase
- [2026-10-28 17:35] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 19:42] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.2 min of 9.3 min total, 0.0 min of it queued for the machine build slot; job j-mvsii7qa-pbzcau (DE-T196), status passed; split, scope or speed up that phase
- [2026-10-28 19:42] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 20:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.4 min of 9.4 min total, 0.0 min of it queued for the machine build slot; job j-mvsiij6j-7wwzid (DE-T198), status failed; split, scope or speed up that phase
- [2026-10-28 20:05] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 20:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.4 min of 9.9 min total, 0.0 min of it queued for the machine build slot; job j-mvsiiise-8u8wxm (DE-T198), status passed; split, scope or speed up that phase
- [2026-10-28 20:05] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 20:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.4 min of 10.0 min total, 0.0 min of it queued for the machine build slot; job j-mvsiujt8-jbkm6l (DE-T196), status landed; split, scope or speed up that phase
- [2026-10-28 20:05] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 21:53] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.4 min of 6.5 min total, 0.0 min of it queued for the machine build slot; job j-mvsn7vs3-q7u911 (DE-T200), status failed; split, scope or speed up that phase
- [2026-10-28 21:53] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-28 23:22] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.8 min of 8.1 min total, 0.0 min of it queued for the machine build slot; job j-mvsq6qgv-dncmff (DE-T208), status landed; split, scope or speed up that phase
- [2026-10-28 23:22] (asked again) 2026-10-28 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 01:12] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 5.7 min of 5.7 min total, 0.0 min of it queued for the machine build slot; job j-mvsu9v1l-2d5fl6 (DE-T205), status passed; split, scope or speed up that phase
- [2026-10-29 01:12] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 01:12] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 5.7 min of 5.8 min total, 0.0 min of it queued for the machine build slot; job j-mvsu82pf-81523g (DE-T214), status landed; split, scope or speed up that phase
- [2026-10-29 01:12] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 16:57] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 11.0 min of 11.0 min total, 0.9 min of it queued for the machine build slot; job j-mvtryj5p-uz3ffn (DE-T230), status failed; split, scope or speed up that phase
- [2026-10-29 16:57] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 17:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.9 min of 8.0 min total, 2.1 min of it queued for the machine build slot; job j-mvtsdtrb-bfm3bq (DE-T230), status passed; split, scope or speed up that phase
- [2026-10-29 17:05] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 17:25] (comment) seen again in claude-kit: broker job over the 5-minute ceiling (KIT-D104): rapid-game pre-push gate phase took 5.4 min of 5.5 min total; job j-mvtt63vp-05kupv (T-1), status landed; split, scope or speed up that phase
- [2026-10-29 17:25] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 21:37] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.5 min of 6.5 min total, 0.2 min of it queued for the machine build slot; job j-mvu234s4-2b343u (DE-T237), status failed; split, scope or speed up that phase
- [2026-10-29 21:37] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 21:37] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.5 min of 7.1 min total, 0.0 min of it queued for the machine build slot; job j-mvu22034-fk3tyw (DE-T209), status landed; split, scope or speed up that phase
- [2026-10-29 21:37] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 21:47] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.3 min of 9.3 min total, 0.5 min of it queued for the machine build slot; job j-mvu235hk-kc2qo4 (DE-T237), status passed; split, scope or speed up that phase
- [2026-10-29 21:47] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-29 22:59] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.5 min of 6.6 min total, 2.2 min of it queued for the machine build slot; job j-mvu521kj-p5c8hq (DE-T234), status passed; split, scope or speed up that phase
- [2026-10-29 22:59] (asked again) 2026-10-29 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 00:35] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 6.7 min of 7.1 min total, 5.1 min of it queued for the machine build slot; job j-mvu8h7qv-6whcwc (KIT-T690), status passed; split, scope or speed up that phase
- [2026-10-30 00:35] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 00:51] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 11.2 min of 11.2 min total, 7.2 min of it queued for the machine build slot; job j-mvu8odz7-epjz5r (DE-T234), status passed; split, scope or speed up that phase
- [2026-10-30 00:51] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 00:51] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 11.2 min of 11.4 min total, 7.2 min of it queued for the machine build slot; job j-mvu8pc2v-1bnr2o (KIT-T690), status landed; split, scope or speed up that phase
- [2026-10-30 00:51] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 02:27] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 2.7 min of 5.6 min total, 2.6 min of it queued for the machine build slot; job j-mvuci31t-rx6gs2 (DE-T208), status failed; split, scope or speed up that phase
- [2026-10-30 02:27] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 02:57] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 12.8 min of 13.0 min total, 3.5 min of it queued for the machine build slot; job j-mvudc2ip-7ctlln (DE-T226), status failed; split, scope or speed up that phase
- [2026-10-30 02:57] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 03:08] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 9.1 min of 9.2 min total, 3.1 min of it queued for the machine build slot; job j-mvudv19o-rvu44u (DE-T226), status passed; split, scope or speed up that phase
- [2026-10-30 03:08] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 03:24] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 8.4 min of 8.4 min total, 3.0 min of it queued for the machine build slot; job j-mvuehmu5-tys9jp (DE-T208), status passed; split, scope or speed up that phase
- [2026-10-30 03:24] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:01] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.6 min of 7.6 min total, 1.7 min of it queued for the machine build slot; job j-mvugu9ch-w9ws2v (DE-T226), status failed; split, scope or speed up that phase
- [2026-10-30 06:01] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:01] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.7 min of 11.1 min total, 3.0 min of it queued for the machine build slot; job j-mvugglni-812bnl (DE-T238), status passed; split, scope or speed up that phase
- [2026-10-30 06:01] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:15] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 3.9 min of 5.5 min total, 2.0 min of it queued for the machine build slot; job j-mvukctu9-008vrp (DE-T226), status passed; split, scope or speed up that phase
- [2026-10-30 06:15] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:15] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 4.0 min of 7.0 min total, 1.1 min of it queued for the machine build slot; job j-mvukm60r-tm969m (DE-T254), status failed; split, scope or speed up that phase
- [2026-10-30 06:15] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:25] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 3.4 min of 5.5 min total, 0.0 min of it queued for the machine build slot; job j-mvukzbs2-ustqr2 (DE-T226), status landed; split, scope or speed up that phase
- [2026-10-30 06:25] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 06:25] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 3.4 min of 5.8 min total, 0.0 min of it queued for the machine build slot; job j-mvukzuht-bjlug3 (DE-T254), status failed; split, scope or speed up that phase
- [2026-10-30 06:25] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 09:18] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 8.1 min of 8.3 min total, 3.6 min of it queued for the machine build slot; job j-mvur4fsu-0jd0e8 (DE-T254), status failed; split, scope or speed up that phase
- [2026-10-30 09:18] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 19:22] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 13.9 min of 14.2 min total, 0.0 min of it queued for the machine build slot; job j-mvvcgf3d-39kum5 (MAR-T034), status passed; split, scope or speed up that phase
- [2026-10-30 19:22] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 19:36] (comment) @claude: j-mvvcgf3d-39kum5 (rapid-game lane, MAR-T034, 836 s run) diagnosed in KIT-T729: coalesce.mjs rewrote two 'cargo t' comma (full comment #1 in ## Notes)
### comment #1 [2026-10-30 19:36] @claude
j-mvvcgf3d-39kum5 (rapid-game lane, MAR-T034, 836 s run) diagnosed in KIT-T729: coalesce.mjs rewrote two 'cargo t' commands into a bare 'cargo nextest run' (no alias --workspace/--features), rebuilding the Bevy stack in a second feature set (402 s); the patch's rg-input gamepad feature change rebuilds 39 workspace crates once (429 s, inherent). Fixed the first in KIT-T729.
- [2026-10-30 22:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 18.7 min of 18.7 min total, 6.0 min of it queued for the machine build slot; job j-mvvhq5a6-mnekzi (MAR-T034), status failed; split, scope or speed up that phase
- [2026-10-30 22:14] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 22:14] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 19.2 min of 27.5 min total, 4.2 min of it queued for the machine build slot; job j-mvvhpa3s-jjwcw2 (DE-T256), status passed; split, scope or speed up that phase
- [2026-10-30 22:14] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 22:22] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 8.2 min of 8.6 min total, 4.5 min of it queued for the machine build slot; job j-mvvisp3f-91kk27 (MAR-T034), status passed; split, scope or speed up that phase
- [2026-10-30 22:22] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 22:48] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 25.2 min of 25.5 min total, 14.2 min of it queued for the machine build slot; job j-mvvj5a05-ty89pj (DE-T256), status landed; split, scope or speed up that phase
- [2026-10-30 22:48] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 22:49] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 25.2 min of 25.5 min total, 14.2 min of it queued for the machine build slot; job j-mvvjg437-uc3r3o (MAR-T034), status landed; split, scope or speed up that phase
- [2026-10-30 22:49] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 22:51] (comment) @claude: train-j-mvvj5a05-ty89pj (rapid-game lane, 2 patches, 1 build, landed): run phase 1510 s = 849 s machine build-slot wait  (full comment #2 in ## Notes)
### comment #2 [2026-10-30 22:51] @claude
train-j-mvvj5a05-ty89pj (rapid-game lane, 2 patches, 1 build, landed): run phase 1510 s = 849 s machine build-slot wait (slotWaitMs 51-184 s on 6 of 7 commands, queued behind dirt-empire root-lane jobs DE-T267 162 s/184 s/85 s and DE-T263 commands, one slot machine-wide, KIT-D105) + 646 s of command time, of which 430 s is ONE command (cd rust && cargo t -p rg-ui-bevy --lib host::, workspace feature set, 19 crates rebuilt after the train's combined patches). Not a rebuild per command: Compiling counts per command are 0,3,1,1,7,19,0. Daemon ran runtime 9dc81e4 (95cc7e1 + adcd3a8 live): rg-ui --lib screens:: took 28 s here (plain -p) vs 203 s in the check-only run j-mvvisp3f before adcd3a8 was live. No kit defect found in this train; the cost is slot queueing plus one inherent workspace rebuild.
- [2026-10-30 23:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.7 min of 7.9 min total, 0.0 min of it queued for the machine build slot; job j-mvvke1yi-uf615s (MAR-T034), status landed; split, scope or speed up that phase
- [2026-10-30 23:05] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 23:05] (comment) seen again in dirt-empire: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 7.7 min of 7.9 min total, 0.0 min of it queued for the machine build slot; job j-mvvkes9r-lkr2v2 (MAR-T034), status landed; split, scope or speed up that phase
- [2026-10-30 23:05] (asked again) 2026-10-30 — cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
- [2026-10-30 23:25] (landed) af1ffdb broker: the attribution baseline is its own phase and is skipped past half the 5-minute ceiling, so a red job no longer
- [2026-10-30 23:25] (landed) 057c592 broker overrun report: one bug per train instead of one per member, a retried phase summed whole with its rounds, queue
- [2026-10-30 23:36] (status) todo → review
- [2026-10-31 00:23] (landed) 262142e broker timing is continuous and self-correcting (KIT-D121): every job sampled by phase, crate and test with measured was
- [2026-10-31 00:23] (status) review → review
- [2026-10-31 00:35] (landed) e17b1a2 timing (KIT-D121): the baseline re-run budget is the lane's measured p90 run time re-derived every tick, not half a fixe
- [2026-10-31 00:38] (landed) 21c2099 timing waste (KIT-D121): a crate an earlier command of the job already compiled is a 'repeat' keyed by the command pair 
