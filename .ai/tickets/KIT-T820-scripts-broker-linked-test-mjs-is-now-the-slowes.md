---
id: KIT-T820
title: scripts/broker/linked.test.mjs is now the slowest kit test file at 113 s in the publish run (2026-11-01, runtime 7cd325b), close to the KIT-
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T00:19:36Z
updated: 2026-11-02T00:35:50Z
---

## Description
scripts/broker/linked.test.mjs is now the slowest kit test file at 113 s in the publish run (2026-11-01, runtime 7cd325b), close to the KIT-D104 five-minute ceiling. Measure what each case spends (git fixture setup, hash-object, submodule clones) and cut the biggest cost, splitting the file per concern if it covers several.

kit-bug-shape: cap:bug:scripts-broker-linked-test-mjs-is-now-the-slowes
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 00:19] (created) bug — scripts/broker/linked.test.mjs is now the slowest kit test file at 113 s in the publish run (2026-11-01, runtime 7cd325b), close to the KIT-
- [2026-11-02 00:35] (comment) @claude: Measured: 6 cases, 68s alone (113s in the suite). 24s of it was fixed sleeps in the two crash cases (hook hold 5s plus a (full comment #1 in ## Notes)
### comment #1 [2026-11-02 00:35] @claude
Measured: 6 cases, 68s alone (113s in the suite). 24s of it was fixed sleeps in the two crash cases (hook hold 5s plus a 7s post-kill sleep each); 632 git spawns made up 43s. Fix: the two crash-recovery cases moved to scripts/broker/linked-crash.test.mjs with the hold cut to 3s and the settle to 4s (both fixtures run in parallel with linked.test.mjs), shared helpers in scripts/broker/linkedkit.mjs. A marker-file hold with a deterministic release was tried and rejected: the orphaned git commit never finishes after its daemon is killed and leaves a stale index.lock. Cases 6 before, 6 after (4 + 2). Times in parallel: linked 37s, linked-crash 28s (was one 68s file).
- [2026-11-02 00:35] (status) todo → review
- [2026-11-02 00:35] (landed) 533bf36 broker linked-landing test: crash-recovery cases split into linked-crash.test.mjs with shorter holds; 6 cases before and
