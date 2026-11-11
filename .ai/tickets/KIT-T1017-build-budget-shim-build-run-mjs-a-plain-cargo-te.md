---
id: KIT-T1017
title: build-budget shim (build-run.mjs): a plain 'cargo test -p <crate>' under rapid-game/rust was queued for 24 cores against a 14-of-16-core bud
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:42:21Z
updated: 2026-11-11T04:53:13Z
---

## Description
build-budget shim (build-run.mjs): a plain 'cargo test -p <crate>' under rapid-game/rust was queued for 24 cores against a 14-of-16-core budget, so it could never be admitted; after 280 s it printed 'still queued after 280s, not started; run again when cores free up' and exited 0 (success), twice. Only 'cargo test -j 8' started. A wait that can never be granted should clamp the want to the budget (or refuse at once), and a not-started job must not exit 0.

kit-bug-shape: cap:bug:build-budget-shim-build-run-mjs-a-plain-cargo-te
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A build that finds fewer cores free than it wants runs capped to them and says so; a build never admitted runs nothing, exits non-zero (75) and names the cores and the budget; the exit-0 symptom was not reproduced at the shim (bash, cmd, PowerShell all 75)

## Plan
1.

## History
- [2026-11-11 04:42] (created) bug — build-budget shim (build-run.mjs): a plain 'cargo test -p <crate>' under rapid-game/rust was queued for 24 cores against a 14-of-16-core bud
- [2026-11-11 04:46] (landed) 5cc1d37 hand-write-detect waits for a lagging Edit confirmation before blaming a shell call for the file (a pre-write prediction
- [2026-11-11 04:49] (comment) @claude: Not reproduced as exit 0: build-run.mjs returns EXIT_QUEUED 75 and the bash shim, cmd and PowerShell all report 75 with  (full comment #1 in ## Notes)
### comment #1 [2026-11-11 04:49] @claude
Not reproduced as exit 0: build-run.mjs returns EXIT_QUEUED 75 and the bash shim, cmd and PowerShell all report 75 with a full-budget hold (checked, runtime adf9781 has the same code); an exit 0 seen by the caller came from a layer above the shim (a pipe or wrapper). grantFor already clamps a want of 24 to the 14-core budget, so the wait was the queue behind other holds and the memory charge on unseen holds, not an unadmittable want. Changed in 5cc1d37: the queue message names min(want, budget) and the budget instead of the raw logical-core count. Tests in scripts/broker/build-run.test.mjs (9 passed, build-budget.test 4): capped run exits 0 and says it ran on the free cores; a never-admitted build runs nothing, exits non-zero, names the cores and budget. Publish refused (same red claim-release-controls, KIT-T944 residual).
- [2026-11-11 04:53] (comment) criterion added: A build that finds fewer cores free than it wants runs capped to them and says so; a build never admitted runs nothing, exits non-zero (75) and names the cores and the budget; the exit-0 symptom was not reproduced at the shim (bash, cmd, PowerShell all 75)
- [2026-11-11 04:53] (comment) ticked: A build that finds fewer cores free than it wants runs capped to them and says so; a build never admitted runs nothing, exits non-zero (75) and names the cores and the budget; the exit-0 symptom was not reproduced at the shim (bash, cmd, PowerShell all 75)
- [2026-11-11 04:53] (comment) @claude: Fix commit 5cc1d37. The exit-0 report has a receipt of a layer above the shim: this session's own piped test run was rep (full comment #2 in ## Notes)
### comment #2 [2026-11-11 04:53] @claude
Fix commit 5cc1d37. The exit-0 report has a receipt of a layer above the shim: this session's own piped test run was reported as exit code 0 by the background notification while the test it piped had output; a pipe or wrapper masks the shim's 75.
- [2026-11-11 04:53] (status) todo → review
