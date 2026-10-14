---
id: KIT-T472
title: Fast multi-agent landing pipeline (Chris 2026-10-14 02:20, verbatim): 'If this means improving the caching of the one writer many worker sys
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T07:14:43Z
updated: 2026-10-14T07:53:11Z
---

## Description
Fast multi-agent landing pipeline (Chris 2026-10-14 02:20, verbatim): 'If this means improving the caching of the one writer many worker system, we should do it.' / 'that can be a separate effort. Making that a streamline tune as efficient as possible. Getting changes in at speed is more important than I'm blocking those changes by tests. Tests can accumulate and run separately, but there should be a much more efficient way to do this that allows for a quicker turnaround on a multi agent set up.' / 'Maybe that means figuring out a way to run more isolated tests more quickly with those agents, I don't know. But we need to make this process less slow.' Scope: broker lands patches without a full-suite gate (build + affected tests only), the full suite runs separately on accumulated landings and bisects on a red, warm cargo cache between jobs.

kit-bug-shape: cap:feature:fast-multi-agent-landing-pipeline-chris-2026-10-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A --land matching a passed check (same HEAD, tree, patch, commands) lands on its evidence without re-running (green.test.mjs; a2214aa)
- [x] The attribution baseline is reused for the same pre-patch tree, pins and command (baseline.test.mjs; 1f0dbc3)
- [x] cargo -j defaults to auto = cores the RAM feeds at 4 GiB a job; a number pins it (jobs.test.mjs; 822a601)
- [x] land_gate affected gates a landing on a workspace check + the targets mapped from changed paths; suite-shaped commands leave the gate; Broker-Gate trailer (affected.test.mjs, landgate.test.mjs; 1dc46ff)
- [x] The suite runs idle on HEAD every suite_every landings, yields to queued jobs, never rewrites the tree; red files one cap regression with range, failing tests, inferred causing_commit (suite.test.mjs; 555dd24)

## Plan
1.

## History
- [2026-10-14 07:14] (created) feature — Fast multi-agent landing pipeline (Chris 2026-10-14 02:20, verbatim): 'If this means improving the caching of the one writer many worker sys
- [2026-10-14 07:52] (comment) criterion added: A --land matching a passed check (same HEAD, tree, patch, commands) lands on its evidence without re-running (green.test.mjs; a2214aa)
- [2026-10-14 07:52] (comment) criterion added: The attribution baseline is reused for the same pre-patch tree, pins and command (baseline.test.mjs; 1f0dbc3)
- [2026-10-14 07:52] (comment) criterion added: cargo -j defaults to auto = cores the RAM feeds at 4 GiB a job; a number pins it (jobs.test.mjs; 822a601)
- [2026-10-14 07:52] (comment) criterion added: land_gate affected gates a landing on a workspace check + the targets mapped from changed paths; suite-shaped commands leave the gate; Broker-Gate trailer (affected.test.mjs, landgate.test.mjs; 1dc46ff)
- [2026-10-14 07:52] (comment) criterion added: The suite runs idle on HEAD every suite_every landings, yields to queued jobs, never rewrites the tree; red files one cap regression with range, failing tests, inferred causing_commit (suite.test.mjs; 555dd24)
- [2026-10-14 07:52] (comment) ticked: A --land matching a passed check (same HEAD, tree, patch, commands) lands on its evidence without re-running (green.test.mjs; a2214aa)
- [2026-10-14 07:52] (comment) ticked: cargo -j defaults to auto = cores the RAM feeds at 4 GiB a job; a number pins it (jobs.test.mjs; 822a601)
- [2026-10-14 07:52] (comment) ticked: The suite runs idle on HEAD every suite_every landings, yields to queued jobs, never rewrites the tree; red files one cap regression with range, failing tests, inferred causing_commit (suite.test.mjs; 555dd24)
- [2026-10-14 07:52] (comment) @claude: Measured 139 dirt-empire broker jobs (35,445 s / 22.8 h): leaf-crate builds 17,158 s (48%; incremental=false, -j 3 on 32 (full comment #1 in ## Notes)
### comment #1 [2026-10-14 07:52] @claude
Measured 139 dirt-empire broker jobs (35,445 s / 22.8 h): leaf-crate builds 17,158 s (48%; incremental=false, -j 3 on 32 cores; deps warm, 3 cold runs from profile/--config flips); attribution baseline re-runs 6,335 s (18%; 18 of 63 repeats); full suite 10,045 s + release probe 9,351 s; check-then-land duplicate 4,041 s (16 of 29 landings); apply/gate/land ~2 s/job. Built: green cache a2214aa, baseline cache 1f0dbc3, -j auto 822a601, affected land gate 1dc46ff, suite cadence 555dd24. Evidence: node --test scripts/broker/*.test.mjs = 136 passed; each new test mutation-checked. Decision write blocked by the auto-mode classifier: refines KIT-D087, to record as KIT-D093 (bisect by tree rewrite rejected per coordinator).
- [2026-10-14 07:53] (comment) ticked: The attribution baseline is reused for the same pre-patch tree, pins and command (baseline.test.mjs; 1f0dbc3)
- [2026-10-14 07:53] (comment) ticked: land_gate affected gates a landing on a workspace check + the targets mapped from changed paths; suite-shaped commands leave the gate; Broker-Gate trailer (affected.test.mjs, landgate.test.mjs; 1dc46ff)
- [2026-10-14 07:53] (status) todo → review
