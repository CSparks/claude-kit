---
id: KIT-T572
title: broker self-check restore-mismatch: j-mvemjork-n4k0ke (failed compile job): after the restore crates/dirt-empire/src/truck/mod.rs, truck/vis
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T02:21:27Z
updated: 2026-10-19T03:30:21Z
---

## Description
broker self-check restore-mismatch: j-mvemjork-n4k0ke (failed compile job): after the restore crates/dirt-empire/src/truck/mod.rs, truck/visuals.rs, arena/mod.rs differ from the journal; HEALTH banner then printed on every later submit/wait. Next job passed and landed 7a3cd2c normally.

kit-bug-shape: cap:bug:broker-self-check-restore-mismatch-j-mvemjork-n4
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: preimage.mjs journals a working file's exact bytes (hash-object --no-filters); writeAsCheckout restores a tracked file with git checkout-index, which writes CRLF under core.autocrlf=true, so an LF pre-image came back as CRLF and the raw-byte compare after the restore reported a mismatch while git status stayed clean. Fixed in a0fb93a: restoreMismatches also accepts a file git adds as the journalled blob, the fault names what differed, and a clean restore resolves earlier restore-mismatch faults. Tests: scripts/broker/restore-check.test.mjs 4 passed (fails without the filtered compare); 38 related broker tests passed. Duplicates folded in: KIT-T573 (j-mvenv4o8-s6sdvw).

## History
- [2026-10-19 02:21] (created) bug — broker self-check restore-mismatch: j-mvemjork-n4k0ke (failed compile job): after the restore crates/dirt-empire/src/truck/mod.rs, truck/vis
- [2026-10-19 02:53] (comment) seen again in dirt-empire: broker self-check restore-mismatch: j-mvemjork-n4k0ke (after the restore crates/dirt-empire/src/truck/mod.rs, truck/visuals.rs, arena/mod.rs differ from the journal; seen on submit of j-mventpfo-uenfgq, runtime 2cc8fa7 pid 10328)
- [2026-10-19 02:53] (asked again) 2026-10-19 — cap:bug:broker-self-check-restore-mismatch-j-mvemjork-n4
- [2026-10-19 03:30] (status) todo → review
