---
id: KIT-T482
title: Writer slot starves other sessions: one session held the stiletto writer slot ~21 h across a 5-lane queue while another waited; needs a per-landing slot lease with a visible queue, then concurrent writers in ONE checkout without copies
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T18:35:51Z
updated: 2026-10-14T18:35:51Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T270, KIT-T276, KIT-T351
### comment #1 [2026-10-14 18:36] @claude
Chris 2026-10-14 13:30, verbatim: 'That shit needs to be optimized. This is tedious as fuck and not conducive to agentic development on the same machine without making a gazillion different fucking repo copies and a gazzillion different builds wasting tons of time, CPU, and space.' Causes (stiletto record): (1) the slot is held per QUEUE, not per landing (2a held it 2026-10-13 16:05 -> 10-14 for N037 L1, N036, L2, L3, gate, L7, L6, L4 with S6/L5a still queued; SESSION.md line 2); (2) no slot tool: handover is prose in SESSION.md, so nothing shows the queue or the age of the hold; (3) the build broker (KIT-T270/T276, docs/BROKER.md: one daemon applies queued patches, one target dir, many read-only workers) is kept down by ST-D228 after an agent spent ~200 min in serial broker waits (stiletto SESSION 2026-10-04, KIT-T326); (4) the rapid-game pre-push gate refuses any dirty rust/, so one writer's uncommitted work blocks every other writer's push, and the full lane takes ~17 min. Copies are ruled out (KIT-D039) and cost ~500 GB of targets each.
### comment #2 [2026-10-14 18:57] @claude
Chris ruled 2026-10-14 ~13:40: short holds (one landing per hold, then hand over), and asked for a plain explanation of how the slot works and why it jams. Not chosen yet: the broker revival and crate-split writers. Build: a slot tool (take / release / queue / who holds it and for how long, shown in orient), policy text: a hold covers one landing.
### comment #3 [2026-10-14 19:10] @claude
Broker logjam forensics (opus analyst, read-only, 2026-10-14). Evidence: stiletto target/broker/results/*.json, 237 timed jobs 2026-10-02..05: 1239 min queued vs 972 min running; 111/243 jobs failed (46%), each failure re-queues the worker.
ROOT CAUSES: (a) strict serial, one patch per build (queue.mjs processOnce; batching was design row L6 "later", docs/design/broker-patch-queue.md:87, never built). (b) cold builds: first stiletto step 230-385 s; .ai/config.yml:204 broker jobs: 3 vs .cargo jobs=24; check-only runs restore files and re-dirty the target; feature/-p sets vary per job; pin.mjs implicitPins flips rapid-game. (c) red main: 16 attribution baselines ~130 min; compile errors already on main never attributed as foreign (patch.mjs runCommands; j-muubw1qw 2399 s on ST-T869). (d) failures: 49 test, 37 rustc, 11 bad cargo flags (1 s each but a full queue trip), 5 missing paths, 5 fetch-first pushes. (e) dirty-tree pause is all-or-nothing per repo (j-murj52m8 paused 180 min then dropped). ST-T824's 191 min = ~72 build, 43 test, 65 wait (50 min daemon idle, cause unverified).
TODAY: land.mjs -> syncPush runs the rapid-game pre-push gate inside the daemon with no CARGO_TARGET_DIR (second cache, -j 3), a 17-min full lane blocks the daemon; gate refusal on dirty rust/ happens AFTER land.mjs commits -> stranded local commit, no pin, later jobs fail implicitPins. KIT-T483 forced suite runs uncancelled (stiletto workspace 3212 s on 10-05) -> ~1 h wait per cadence.
FIXES ranked: 1 batch trains (batch.mjs; apply non-overlapping patches, one feature-stable nextest build with rdeps filter, attribute compile errors by file and tests by affected.mjs, bisect only ambiguous, land greens in order, one push). 2 warm builds (jobs auto, drop separate check run, validate cargo commands at submit in submit-lib.mjs). 3 gate inside the train (daemon runs pre-push.mjs with shared target + jobs, pushes on the stamp; check gated-path dirt before commit in land.mjs). 4 cross-repo linked job (pin.mjs, land.mjs). 5 known-red list keyed by HEAD; foreign compile errors exclude the target. 6 suite as rotating nextest partitions per train (suite.mjs). 7 patch-worker waits in background (wait.mjs --timeout 7200) and prepares the next patch. 8 session field + round-robin (submit.mjs, queue.mjs). 9 three-way merge-file for stale patches (plan.mjs).
VETTING: claude-kit/scripts/broker/acceptance/train.mjs, fixture tier (small cargo workspace + submodule + bare remote + sleeping pre-push stub) and live stiletto check-only tier. Load: 3 workers on separate leaf crates within 30 s + 1 red + 1 job from a second session. Targets: each green waits <= 1.5x single-job wall time, last green lands <= 15 min after last submit, <= 2 builds, red isolated and named, greens land in submit order, rapid-game push first try, .rhai hashes unchanged, <= 2 worker tool calls while waiting. Invariant tests that fail today: batch.test.mjs (4 jobs -> 1 build), gate-env.test.mjs (hook sees CARGO_TARGET_DIR), land-gate-dirty.test.mjs (dirty rust/ refused before commit), suite-shard.test.mjs.
OPEN for Chris: broker replaces the writer slot (both sessions broker clients)? goldens over Chris's dirty .rhai treated as foreign? -j 24 vs -j 3 (os error 1455 memory): measure one leaf build at both before changing config.
### comment #4 [2026-10-14 19:28] @claude
Chris ruled 2026-10-14 ~14:30 (questionnaire, session stiletto-2349-2a; captures inbox 2026-10-14-1911-*): (1) once the broker passes its vetting run (ST-T904), the broker REPLACES the hand-off writer turn: every session on a checkout submits patches; no agent edits code by hand while the daemon runs; Chris may still edit by hand. (2) A failing golden that reads one of Chris's uncommitted .rhai edits counts as already-red (foreign) and never blames the patch under test. Kit work: dirt-empire's KIT-T472 writer (order: KIT-T486 runtime-prune crash, suite partitions, gate in train + stranded commit, batch trains, then known-red/linked job/round-robin/KIT-T487).

## History
- [2026-10-14 18:35] (created) feature — Writer slot starves other sessions: one session held the stiletto writer slot ~21 h across a 5-lane queue while another waited; needs a per-landing slot lease with a visible queue, then concurrent writers in ONE checkout without copies
- [2026-10-14 18:36] (comment) @claude: Chris 2026-10-14 13:30, verbatim: 'That shit needs to be optimized. This is tedious as fuck and not conducive to agentic (full comment #1 in ## Notes)
- [2026-10-14 18:57] (comment) @claude: Chris ruled 2026-10-14 ~13:40: short holds (one landing per hold, then hand over), and asked for a plain explanation of  (full comment #2 in ## Notes)
- [2026-10-14 19:10] (comment) @claude: Broker logjam forensics (opus analyst, read-only, 2026-10-14). Evidence: stiletto target/broker/results/*.json, 237 time (full comment #3 in ## Notes)
- [2026-10-14 19:28] (comment) @claude: Chris ruled 2026-10-14 ~14:30 (questionnaire, session stiletto-2349-2a; captures inbox 2026-10-14-1911-*): (1) once the  (full comment #4 in ## Notes)
