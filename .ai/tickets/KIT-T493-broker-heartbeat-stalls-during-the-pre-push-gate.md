---
id: KIT-T493
title: broker heartbeat stalls during the pre_push gate: broker.beat is not written while 'git hook run pre-push' runs (rapid-game gate compiles ~1
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T21:27:05Z
updated: 2026-10-14T22:01:21Z
---

## Description
broker heartbeat stalls during the pre_push gate: broker.beat is not written while 'git hook run pre-push' runs (rapid-game gate compiles ~17 min), so wait.mjs/submit.mjs print 'broker HEALTH stalled: no beat for 470 s' and would 'kill and restart' the daemon after 10 min, killing a live landing mid-gate. Seen 2026-10-14 job j-mv8m0kgf-tqwgvg (pre-push.log still growing at the time). Fix: beat from the pre-push runner (or a timer) while the child runs.

kit-bug-shape: cap:bug:broker-heartbeat-stalls-during-the-pre-push-gate
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 21:27] (created) bug — broker heartbeat stalls during the pre_push gate: broker.beat is not written while 'git hook run pre-push' runs (rapid-game gate compiles ~1
- [2026-10-14 21:27] (comment) seen again in stiletto-2349: broker heartbeat stalls during the pre_push gate: broker.beat is not written while 'git hook run pre-push' runs (rapid-game gate compiles ~17 min), so wait.mjs/submit.mjs print 'broker HEALTH stalled: no beat for 470 s' and would kill and restart the daemon after 10 min, killing a live landing mid-g
- [2026-10-14 21:27] (asked again) 2026-10-14 — cap:bug:broker-heartbeat-stalls-during-the-pre-push-gate
- [2026-10-14 22:01] (comment) @claude: Fixed: the landing's git calls (commit, pre-push gate, push, pin commit/push) run beside a pulse (run-pulsing.mjs, git.m (full comment #1 in ## Notes)
### comment #1 [2026-10-14 22:01] @claude
Fixed: the landing's git calls (commit, pre-push gate, push, pin commit/push) run beside a pulse (run-pulsing.mjs, git.mjs gitLong); phase changes pulse; the watchdog never kills inside a landing phase or past a commit (stall.mjs landingHold); stall_kill_s config key (0 never kills); the kill is recorded (killed.json -> result.killed); the journal is re-based at commit (preimage markCommitted) and a restart finishes the landing (resume.mjs) instead of restoring pre-images. scripts/broker/watchdog.test.mjs 5 passed (a landing whose pre-push gate outlasts stall_kill_s 1 keeps its beat under 2.5 s and restartIfWedged refuses to kill it; negative control: the same watchdog kills a daemon stalled in a run phase and the kill lands in the result once; a SIGKILL after commit leaves the tree at the commit and the restart pushes it, result resumed; negative control: the same journal without the commit marker reverses the tree), launch.test.mjs 3 passed (live: Win32_Process.Create daemon writes target/broker/logs/daemon-*.log and is not the caller's child). Mutation: the pre-push gate back on spawnSync fails the beat test. npm test exit 0, broker 193 passed.
- [2026-10-14 22:01] (status) todo → review
