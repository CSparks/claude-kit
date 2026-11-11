---
id: KIT-T874
title: broker: dirt-empire check compile ran past 10 min limit (j-mw5ikw2m-49vfj8 failed) under contending cargo daemons; first compile 20+ min
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T873
superseded_by:
created: 2026-11-06T22:12:28Z
updated: 2026-11-06T22:12:28Z
---

## Description
broker: dirt-empire check compile ran past 10 min limit (j-mw5ikw2m-49vfj8 failed) under contending cargo daemons; first compile 20+ min

kit-bug-shape: cap:bug:broker-dirt-empire-check-compile-ran-past-10-min
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [x] Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS

## Plan
1.

## Notes
ROOT CAUSE (2026-11-06, from dirt-empire target/broker results + process listing). Not a cold or per-job target dir: one shared D:/dev/dirt-empire/target (CARGO_TARGET_DIR), check tree target/broker/check/dirt-empire. The job compiled only dirt-empire+race (dirty FsStatusOutdated); the other units were fresh. MEASURED from results/*.json: dirt-empire lib+test compile uncontended 421 s (j-mw43wxg0, cold: no earlier fingerprint) and 433 s (j-mw5iu5vz-eeup4i, 22:11-22:19Z); warm incremental after a dependency rebuild + one source change 50 s / 28 s (j-mw5k3767, j-mw5k6v4k); no change 6-12 s. j-mw5ikw2m-49vfj8 ran the same compile 21:58-22:11Z and was killed at the 600 s limit (rustc keeps nothing of a killed crate, so the slice was lost and eeup4i redid it): >600 s vs 433 s uncontended means the box was contended. Cargo/rustc seen beside the broker on this machine today: rapid-game pre-push gate (scripts/gate/pre-push.mjs -> npm run check:test, check:doctest, check-template: cargo check --workspace --all-targets, cargo test --doc --workspace -j 3) and hand-run cargo in other agent sessions (cargo t -p hud -p materials); none takes the KIT-D105 build slot (slot-0 held only by the dirt-empire daemon). The 3 stale measure jobs (j-mw5hj40v-je7zjg, j-mw5hsm7r-84suum, j-mw5iexqw-1j1ijj) were idle-lane work that ran at 22:19-22:21Z and finished (status measured, FALL data in je7zjg-1.log); nothing was left to cancel. No warm-build step exists for dirt-empire test builds (only precheck's cargo check in precheck-target). FIX (32d78e3, runtime published after): scripts/broker/build-contention.mjs samples foreign cargo builds before every broker cargo build and again at a timeout kill; the result carries contendedBy and the timeout message names them. A bounded wait on foreign builds is built but OFF (CLAUDE_KIT_CONTENTION_WAIT_MS=<ms>) because KIT-D105 makes the build slot the only cross-directory wait: needs Chris's amendment of D105 to switch on. Structural remainder: the rapid-game pre-push hook and hand-run cargo bypass the slot; the 600 s limit is unchanged. The 181 GB target/debug runaway is KIT-T485 (not measured here: du over target timed out).

## History
- [2026-11-06 22:12] (created) bug — broker: dirt-empire check compile ran past 10 min limit (j-mw5ikw2m-49vfj8 failed) under contending cargo daemons; first compile 20+ min
- [2026-11-06 23:03] (comment) criterion added: A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [2026-11-06 23:03] (comment) criterion added: Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS
- [2026-11-06 23:03] (comment) ticked: A broker cargo build samples foreign cargo builds before it starts and names them (contendedBy) in its result and in a timeout message
- [2026-11-06 23:03] (comment) ticked: Waiting on foreign builds is off by default (KIT-D105) and opt-in by CLAUDE_KIT_CONTENTION_WAIT_MS
- [2026-11-06 23:04] (landed) 9172c3f broker: sample foreign cargo builds before a build and at a timeout kill, bounded wait opt-in (implements KIT-T874, KIT-
- [2026-11-06 23:12] (landed) 32d78e3 broker: make the contention run test wait for its foreign build to be visible (implements KIT-T874)
- [2026-11-06 23:17] (landed) c1e1926 tickets: KIT-T874 root cause and fix notes, KIT-T873 superseded (implements KIT-T874)
