---
id: KIT-T1115
title: broker: no implicit tests. The maintainer 2026-11-13: 'OK... one thing. the BROKER SHOULD NOT BE IMPLICITLY RUNNING TESTS EVERY FUCKING TIME
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: [KIT-D163, KIT-D162]
files: []
supersedes:
superseded_by:
created: 2026-11-13T05:06:18Z
updated: 2026-11-13T05:47:13Z
---

## Description
broker: no implicit tests. The maintainer 2026-11-13: 'OK... one thing. the BROKER SHOULD NOT BE IMPLICITLY RUNNING TESTS EVERY FUCKING TIME'. docs/BROKER.md describes the daemon as applying a patch, running the gates, and BUILDING AND TESTING before landing; precheck runs affected.check on submit; idle work re-runs deferred tests and suites. Wanted: the broker runs a test only when the patch's envelope asks for it by name (an explicit test command the worker chose, scoped to what the change reaches), never a suite or an 'affected' test set on its own initiative for every patch; what it does by default per patch is the minimum that protects other writers: apply, the pre-write gate, and a compile check of the touched packages (say exactly what that is and make even that a setting); idle-time suite runs and deferred re-runs are opt-in settings, off by default; every implicit run that remains is listed in docs/BROKER.md with the setting that turns it off. Record the kit decision with his words; say what the default config is after the change and what a project sets to get the old behaviour.

kit-bug-shape: cap:feature:broker-no-implicit-tests-the-maintainer-2026-11-
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 16bb526, runtime f1f968f. Defaults: verify_default none, land_gate check, patch_check touched, attribute_failures false, recheck_deferred false; suite approval-only (KIT-T1057 item 1). Implicit-run inventory and the one setting per run: docs/BROKER.md 'Implicit runs'. Tests: scripts/broker/no-implicit-tests.test.mjs 7 passed (commands the broker would run asserted; negative controls), landgate family, suite family, attribute, recheck, known-red, autopin, patch, train, config-edit: all passed. Fixed three landgate.test.mjs expectations that still assumed an unapproved suite run (red since KIT-T1057 23c57b9). Not done: KIT-D162 point (c), whether cheap landing checks (the compile check, affected.conformance) stay, is unconfirmed; the commit gate's evidence floor wording (KIT-T061) is untouched.

## History
- [2026-11-13 05:06] (created) feature — broker: no implicit tests. The maintainer 2026-11-13: 'OK... one thing. the BROKER SHOULD NOT BE IMPLICITLY RUNNING TESTS EVERY FUCKING TIME
- [2026-11-13 05:07] (comment) @claude: ALREADY RULED, not new: KIT-D162 (2026-11-11: 'There should not be a test gate for commit since multiple projects share  (full comment #1 in ## Notes)
### comment #1 [2026-11-13 05:07] @claude
ALREADY RULED, not new: KIT-D162 (2026-11-11: 'There should not be a test gate for commit since multiple projects share this machine and it's very taxing.') and KIT-D163 (2026-11-11: tests between daily full runs run on the touched crates, 'As needed.' 'Not implicitly.'). Chris 2026-11-13: 'the BROKER SHOULD NOT BE IMPLICITLY RUNNING TESTS EVERY FUCKING TIME' 'AND I FUCKING RULED ON THIS DAYS AGO.' So this ticket is: make the broker and its docs CONFORM to those two decisions (docs/BROKER.md still describes the daemon building and testing each patch before landing, precheck running affected.check, idle suite and deferred re-runs); check what KIT-T1057 (todo) and KIT-T1036 already cover and fold in rather than duplicate; report which implicit runs exist in the code today, remove or switch off each by default, and list in the doc the one setting per run. No new decision is needed: cite KIT-D162 and KIT-D163.
- [2026-11-13 05:07] (comment) @claude: Chris 2026-11-13, further words for this ticket: 'TESTS SLOW THINGS DOWN. THEY NEED TO BE RAN PERIODICALLY OR TO TROUBLE (full comment #2 in ## Notes)
### comment #2 [2026-11-13 05:07] @claude
Chris 2026-11-13, further words for this ticket: 'TESTS SLOW THINGS DOWN. THEY NEED TO BE RAN PERIODICALLY OR TO TROUBLESHOOT PROBLEMS, NOT IMPLICITLY AT EVERY FUCKING COMMIT.' 'RUST BUILDS ARE SLOW AS FUCK'. Applies beyond the broker: agent briefs and agent definitions in the kit that tell an agent to run a list of tests after every step or before every commit (implementer, patch-worker, test-author, the commit gate's evidence floor wording) are brought in line: compile check of the touched crate by default; a test only to troubleshoot or once per body of work, the one that measures the change; periodic full runs on the maintainer's say.
- [2026-11-13 05:39] (landed) 16bb526 broker: no implicit tests: a patch runs only the commands its envelope names, plus a compile check of the touched packag
- [2026-11-13 05:47] (status) todo → review
