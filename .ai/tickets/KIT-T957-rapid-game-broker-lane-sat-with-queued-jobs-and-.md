---
id: KIT-T957
title: rapid-game broker lane sat with queued jobs and no daemon: dirt-empire 2026-11-10, j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapid-game) plu
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:23:03Z
updated: 2026-11-10T18:50:46Z
---

## Description
rapid-game broker lane sat with queued jobs and no daemon: dirt-empire 2026-11-10, j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapid-game) plus j-mwaz3yod and j-mwazgkmu sat in target/broker/lanes/rapid-game/queue until a daemon started at 18:21:09Z ('1 job(s) queued with no daemon'). The root-lane daemon was alive throughout; a rapid-game landing (j-mwaybi67) did complete at 18:14. A queued job in any lane must have a live daemon within a minute, and broker status should flag a lane with queue/ entries and no daemon.

kit-bug-shape: cap:bug:rapid-game-broker-lane-sat-with-queued-jobs-and-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:23] (created) bug — rapid-game broker lane sat with queued jobs and no daemon: dirt-empire 2026-11-10, j-mwayf0ye-qfv39r (submitted 17:20Z, repo rapid-game) plu
- [2026-11-10 18:50] (comment) @claude: Premise correction (logs, dirt-empire target/broker/lanes/rapid-game/logs): the lane never had a daemon gap. Daemon chai (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:50] @claude
Premise correction (logs, dirt-empire target/broker/lanes/rapid-game/logs): the lane never had a daemon gap. Daemon chain 38684 (16:31) -> 44984 (17:08:51-18:14:01) -> 63212 (18:14:02-18:21:08) -> 32512 (18:21:09); every hand-over was 'runtime X superseded by published Y; restarted' (61018ae->4db5a72->c83452e->ec0c0e1, four publishes in 2 h). Jobs j-mwayf0ye/j-mwaz3yod/j-mwazgkmu waited because (1) 44984 ran j-mwaybi67 (cold ~33 min build, landed 18:14:00) serially, then (2) rapid-game tree was held by lane root (root job j-mwazd92y running since 18:14:15; 'yielding to lane root, which is waiting for it'). The '1 job(s) queued with no daemon' text the reporter saw is the lock's spawnedBy: restartFromCurrent kept the first daemon's --spawned-by across every runtime hand-over, so 32512's lock carried a submit pid (63796) from an earlier spawn. Real gaps fixed: (a) successor lock now names the hand-over, (b) a failed hand-over launch (result ignored before) leaves the lane with the old daemon, (c) daemons now start a daemon for any other lane with queued jobs and none (30 s throttle, no new loop), (d) status shows QUEUED WITHOUT A DAEMON with lane and oldest age, and for a live lane the oldest age plus tree locks other lanes hold. Design question raised, not changed: root idle work (re-checks/suite) takes the rapid-game tree without priority and held it 16:49-17:08, and the root lane's later job won the tree over three older rapid-game jobs.
- [2026-11-10 18:50] (comment) @claude: Evidence: scripts/broker/supervise.test.mjs 5 passed (real lane dirs + locks; a real root daemon starts the rapid-game l (full comment #2 in ## Notes)
### comment #2 [2026-11-10 18:50] @claude
Evidence: scripts/broker/supervise.test.mjs 5 passed (real lane dirs + locks; a real root daemon starts the rapid-game lane daemon which runs the queued job, control with BROKER_NO_AUTOSTART leaves it queued), handover.test.mjs 3 passed (successor argv drops old spawn reason; failed launch keeps the lock), daemon-state.test.mjs 5 passed (queued-no-daemon flag with lane and oldest age, empty lane quiet, live-daemon tree-hold line, dead/own holder not listed). Related modules 70 passed (ensure, liveness, crash-recovery, idle, control, hand-hold, subtree, subtree-reclaim, gate-exclusive, dirty-hold, reattach, command-summary, baseline-budget, timing-flagged).
- [2026-11-10 18:50] (status) todo → review
- [2026-11-10 18:50] (landed) 00c812e Broker: a daemon starts a daemon for any other lane with queued jobs; runtime hand-over names itself as the successor's
- [2026-11-10 19:01] (comment) @claude: Follow-up in the same landing: the supervise check also runs from the daemon's heartbeat pulse, so it fires while a long (full comment #3 in ## Notes)
### comment #3 [2026-11-10 19:01] @claude
Follow-up in the same landing: the supervise check also runs from the daemon's heartbeat pulse, so it fires while a long job runs (a daemon busy 33 min no longer blocks it); new flag broker.mjs --supervise-ms <ms> (default 30000). Evidence: scripts/broker/supervise.test.mjs 6 passed incl. a root daemon mid 60 s job starting the rapid-game lane daemon; mutation (pulse hook removed) fails that test; control with BROKER_NO_AUTOSTART leaves the lane queued.
- [2026-11-10 19:01] (landed) a58d1dc Broker: the lane supervisor also runs from the daemon pulse, so a daemon in the middle of a long job still starts a miss
- [2026-11-10 19:08] (landed) adf9781 Codex manifest version follows the Claude manifest (0.1.39): plugin-compat was red on HEAD and refused the runtime publi
- [2026-11-10 19:10] (comment) @claude: Landed: 00c812e, a58d1dc (broker), adf9781 (Codex manifest 0.1.38 -> 0.1.39: eb9eb7f bumped only the Claude manifest, pl (full comment #4 in ## Notes)
### comment #4 [2026-11-10 19:10] @claude
Landed: 00c812e, a58d1dc (broker), adf9781 (Codex manifest 0.1.38 -> 0.1.39: eb9eb7f bumped only the Claude manifest, plugin-compat was red on HEAD and refused the publish). Published runtime adf9781; publish suite green (the full run showed hand-write-detect 2 failed once under 16-worker load and 69/0 alone and on rerun: flaky, not touched). Note for operators: a sibling daemon restarts a lane with queued jobs within ~30 s, so stop --now on one lane is undone while it has jobs; pause is the way to hold a lane. Daemons already on ec0c0e1 run the old hand-over once more (stale spawnedBy) before the new code takes over.
