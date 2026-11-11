---
id: KIT-T911
title: build-sweep (KIT-T636) silently skips a cargo target dir that lacks CACHEDIR.TAG: D:/dev/dirt-empire/target has .fingerprint profiles but no
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T01:20:45Z
updated: 2026-11-09T01:20:45Z
---

## Description
build-sweep (KIT-T636) silently skips a cargo target dir that lacks CACHEDIR.TAG: D:/dev/dirt-empire/target has .fingerprint profiles but no tag, so discover.mjs marks it cargo:false (unverified) and it is never pruned — 215 GB in target/debug/deps, 183 GB of it older generations (7-14 days old), 0 bytes removed on 11-05/06/08; every receipt shows unverified:1 and nobody is told. D:/dev totals 463 GB. Fix: a <crate-root>/target beside Cargo.toml with .fingerprint profile dirs is verified (or the sweep restores the tag); any unverified dir over a size threshold is a loud SessionStart alert with its size, never a silent count. Also uncovered: dirt-empire/target/broker 38 GB, lane de-t184 7.7 GB, stranded temp workspaces (D:/dev/rg-lanes 23 GB, 54 lane clones from 2026-10-28; D:/dev/tracy-run 22 GB profiler captures 2026-10-02) that nothing tracks or reaps.

kit-bug-shape: cap:bug:build-sweep-kit-t636-silently-skips-a-cargo-targ
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 01:20] (created) bug — build-sweep (KIT-T636) silently skips a cargo target dir that lacks CACHEDIR.TAG: D:/dev/dirt-empire/target has .fingerprint profiles but no
- [2026-11-09 17:53] (landed) cb3ea43 build-sweep: an untagged primary target beside Cargo.toml with a .fingerprint is verified and pruned; unverified build d
- [2026-11-09 19:14] (comment) @claude: Cleanup run 2026-11-09 by session 9d88860c on Chris's questionnaire approval: dirt-empire target/debug/deps superseded g (full comment #1 in ## Notes)
### comment #1 [2026-11-09 19:14] @claude
Cleanup run 2026-11-09 by session 9d88860c on Chris's questionnaire approval: dirt-empire target/debug/deps superseded generations removed (21,328 files, 132.1 GB, guard clear); D:/dev/rg-lanes deleted (all 48 lanes' files verified present on rapid-game origin/main 00115f19; 3 one-line uncommitted edits + per-lane commit lists saved to ~/.claude/salvage/rg-lanes-2026-11-09/); tracy-run after.csv + before.csv deleted (21.6 GB; .tracy captures, analysis txt, logs kept). Fix landed by stiletto in cb3ea43. Note: Chris later answered stiletto 'Hold the sweep off that directory' for dirt-empire/target; no further pruning there.
- [2026-11-09 19:15] (landed) 4b02eb2 build-sweep: a hold list (build-sweep-holds.txt in the sweep home) keeps listed build dirs untouched; the receipt report
