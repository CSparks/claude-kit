---
id: KIT-T810
title: broker land gate: the dependents run was one cargo test per crate, so each command got its own feature set and recompiled the shared crates (dirt-empire land j-mvydj8de-fhpscb: rg-meshkit-bevy compiled 4 times, 8m38s of compile in 4 commands)
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T801]
files: []
supersedes:
superseded_by:
created: 2026-11-01T22:18:26Z
updated: 2026-11-01T22:18:47Z
regressed_from: KIT-T719
---

## Description
Waste class of KIT-T801, KIT-T802, KIT-T803. The check job j-mvyda56p ran three commands in about 6 minutes; the land of DE-T267 added five dependents commands (logs 4 to 8), each cargo test -p <crate>. Each command unifies features for its own package set, so rg-meshkit-bevy (28 fingerprint variants exist in target/debug/.fingerprint) compiled in four of the five (1m20, 2m37, 1m43, 2m58), rg-meshkit-script and rg-rig in three. Not content-align: its ledger compares consecutive commands of one tree, so inside a job it touches nothing. Fix: landgate.mjs names every dependent of a workspace in one command.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A land gate names every dependent of a workspace in one cargo command (scripts/broker/landgate-dependents.test.mjs)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T719, KIT-T615, KIT-T483
Evidence: logs j-mvydj8de-fhpscb-4..8 (target/broker/logs) compile rg-meshkit-bevy in 4, 6, 7, 8 (1m20, 2m37, 1m43, 2m58 finished-in), each a new fingerprint variant. Log 8 also shows a cross-tree stale: the variant b93f4be187e3d8ba, last built Oct 31 from the rapid-game lane check tree, is judged stale by that tree's file mtime (a cargo dep-info with absolute paths), a second-order cost not fixed here. Fix: scripts/broker/landgate.mjs dependentTests emits one command per workspace naming every dependent; scripts/broker/landgate-dependents.test.mjs updated (landgate-dependents, landgate, landgate-explicit, landgate-folded, pin-scope, affected: 31 passed). Not measured: the land's wall time after the change (needs a real land); expectation is each shared crate compiles once per land instead of once per dependent command.

## History
- [2026-11-01 22:18] (created) bug — broker land gate: the dependents run was one cargo test per crate, so each command got its own feature set and recompiled the shared crates (dirt-empire land j-mvydj8de-fhpscb: rg-meshkit-bevy compiled 4 times, 8m38s of compile in 4 commands)
- [2026-11-01 22:18] (status) todo → doing
- [2026-11-01 22:18] (comment) criterion added: A land gate names every dependent of a workspace in one cargo command (scripts/broker/landgate-dependents.test.mjs)
- [2026-11-01 22:18] (comment) ticked: A land gate names every dependent of a workspace in one cargo command (scripts/broker/landgate-dependents.test.mjs)
- [2026-11-01 22:18] (status) doing → review
