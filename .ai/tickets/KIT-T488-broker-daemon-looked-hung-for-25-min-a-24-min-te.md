---
id: KIT-T488
title: Broker daemon looked hung for 25 min: a 24-min test-only full-suite job (cargo test -p dirt-empire, j-mv8hjxwe-cxbkqs) wrote no heartbeat; status said running; nothing detects or restarts a truly wedged daemon
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T19:59:34Z
updated: 2026-10-14T20:00:19Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)

## Plan
1.

## History
- [2026-10-14 19:59] (created) bug — Broker daemon looked hung for 25 min: a 24-min test-only full-suite job (cargo test -p dirt-empire, j-mv8hjxwe-cxbkqs) wrote no heartbeat; status said running; nothing detects or restarts a truly wedged daemon
- [2026-10-14 20:00] (comment) criterion added: The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)
- [2026-10-14 20:00] (comment) ticked: The daemon beats every second while a command runs (pulse through runCancellable); broker status prints 'STALLED: no beat for N s, M queued (pid P)' for a live holder whose beat is older than 2 min with jobs queued; submit and wait kill and replace a holder stalled past 10 min (stall.test.mjs 3 passed; removing the pulse fails it)
- [2026-10-14 20:00] (comment) @claude: Cause (read-only, D:\dev\dirt-empire\target\broker): not a hang. After j-mv8hjxwe-cxbkqs started at 19:17:49Z, the daemo (full comment #1 in ## Notes)
### comment #1 [2026-10-14 20:00] @claude
Cause (read-only, D:\dev\dirt-empire\target\broker): not a hang. After j-mv8hjxwe-cxbkqs started at 19:17:49Z, the daemon ran a test-only job (no ops, no ticket) whose command was the full suite 'cargo test --offline -p dirt-empire': 1,426 s, finished 19:41:55Z, passed. The beat is written only between drains, so it froze for the whole run and status still said 'running'. Fixed: pulse during commands; STALLED status and health entry; a watchdog restart in submit/wait past 10 min. Broker 162 passed.
- [2026-10-14 20:00] (status) todo → review
- [2026-10-14 20:14] (comment) @claude: Also: under land_gate affected, submit refuses a suite-shaped --test in any worker job and a --no-patch job without --te (full comment #2 in ## Notes)
### comment #2 [2026-10-14 20:14] @claude
Also: under land_gate affected, submit refuses a suite-shaped --test in any worker job and a --no-patch job without --test ('full suites run on the cadence; list the targets you touched'); a patch job without --test takes the affected gate, never verify_default. suite-refusal.test.mjs 2 passed; broker 164 passed.
- [2026-10-14 21:29] (comment) @claude: DEFECT (stiletto 2026-10-14 16:28 CDT, job j-mv8m0kgf-tqwgvg RG-T111 --land): the stall watchdog in wait.mjs killed the  (full comment #3 in ## Notes)
### comment #3 [2026-10-14 21:29] @claude
DEFECT (stiletto 2026-10-14 16:28 CDT, job j-mv8m0kgf-tqwgvg RG-T111 --land): the stall watchdog in wait.mjs killed the live daemon (pid 60356, runtime 4f17789) after 'no beat for 600 s' while the daemon was inside the LAND phase: pre_push gate (rapid-game check:all, ~17 min) runs with no beat, so a healthy landing looks stalled. Effects: the commit c75ee92b was made, the push never ran; the replacement daemon (pid 54596, a4e695a) restored the journalled pre-images AFTER the commit, so the rapid-game tree became the reverse of its own HEAD (11 files M/D) and the queue paused 'dirty' for two sessions. Wanted: (1) beat during every phase (land gate, push, pin) or suspend the watchdog while inflight.json names a land phase; (2) never kill a daemon whose inflight job is past commit; (3) a journal is cleared or re-based at commit so a restart never restores pre-images over a committed HEAD; (4) the result file records the land-gate commands and the kill.
- [2026-10-14 21:32] (comment) @claude: Add-on: (a) the stall limit has no config key in the published runtime (no 'stall' key in config.mjs/pipeline-config.mjs (full comment #4 in ## Notes)
### comment #4 [2026-10-14 21:32] @claude
Add-on: (a) the stall limit has no config key in the published runtime (no 'stall' key in config.mjs/pipeline-config.mjs/wait.mjs), so a checkout cannot raise it above its longest pre_push; the stiletto daemon stays PAUSED until the fix publishes. (b) cap.mjs bug seen while filing the spawned-daemon item: cap refuses with 'KIT-T271 [todo] ...' even when KIT-T271 is already in --not-dup (also KIT-T003/T005/T001 fixture ids), so the capture never landed; the item is in dirt-empire's writer queue by message instead. Make --not-dup honoured for every id it names.
- [2026-10-14 22:01] (comment) @claude: Comment #3/#4 addressed under KIT-T493 (beat in every landing phase, no kill inside a landing or past a commit, journal  (full comment #5 in ## Notes)
### comment #5 [2026-10-14 22:01] @claude
Comment #3/#4 addressed under KIT-T493 (beat in every landing phase, no kill inside a landing or past a commit, journal re-based at commit + resume, kill recorded in the result, stall_kill_s key) and KIT-T496 (detached, logging replacement daemon). The cap --not-dup refusal is KIT-T497.
