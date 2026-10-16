---
id: KIT-T534
title: broker: a train pays a COLD crate build inside a check job (rg-probe-kit --lib 1203 s in j-mv9y65ye, rapid-game lane 2026-10-15), then the l
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T23:39:45Z
updated: 2026-10-15T23:39:45Z
---

## Description
broker: a train pays a COLD crate build inside a check job (rg-probe-kit --lib 1203 s in j-mv9y65ye, rapid-game lane 2026-10-15), then the land train rebuilds the same crates in reverify (rg-graphics degrade 669 s, lib 472 s, probe-kit 554 s). Chris: no cold workspace builds, one warm build per train. Root cause to find: reverify after the train commit discards the check build (feature/profile flip or target dir reset?). ST-T904#18 FAULT 6. --priority high

kit-bug-shape: cap:bug:broker-a-train-pays-a-cold-crate-build-inside-a-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 23:39] (created) bug — broker: a train pays a COLD crate build inside a check job (rg-probe-kit --lib 1203 s in j-mv9y65ye, rapid-game lane 2026-10-15), then the l
- [2026-10-15 23:40] (comment) seen again in stiletto-2349: broker: a train pays a COLD crate build inside a check job (rg-probe-kit --lib 1203 s in j-mv9y65ye, rapid-game lane 2026-10-15), then the land train rebuilds the same crates in reverify (rg-graphics degrade 669 s, lib 472 s, probe-kit 554 s). Chris: no cold workspace builds, one warm build per trai
- [2026-10-15 23:40] (asked again) 2026-10-15 — cap:bug:broker-a-train-pays-a-cold-crate-build-inside-a-
- [2026-10-16 00:47] (comment) @claude: cause (inferred, no stiletto log available): KIT-T516's -p narrowing dropped --workspace from the alias, changing cargo' (full comment #1 in ## Notes)
### comment #1 [2026-10-16 00:47] @claude
cause (inferred, no stiletto log available): KIT-T516's -p narrowing dropped --workspace from the alias, changing cargo's feature unification so check builds and land builds produced different artifacts and rebuilt crates cold. KIT-T527 (45d4937, runtime 1a92179) keeps --workspace --features fastdev identical to the alias and filters with -E package(X); alias.test.mjs pins the expansion. Verify on the next stiletto train; no further code change. [no-test: covered by alias.test.mjs]
- [2026-10-16 14:58] (comment) @claude: Vetting 2026-10-16: NOT fixed. ST-T904#19 called it fixed by T527; logs say no: j-mvaauib3 compiled 1m57 + 2m47 (-0.log: (full comment #2 in ## Notes)
### comment #2 [2026-10-16 14:58] @claude
Vetting 2026-10-16: NOT fixed. ST-T904#19 called it fixed by T527; logs say no: j-mvaauib3 compiled 1m57 + 2m47 (-0.log:12, -1.log:12), j-mvaa7nki compiled 561 of 563 s, both on runtime bbf841f. Keep open; root cause still unfound (reverify discarding the check build).
