---
id: KIT-T539
title: broker deferred recheck is a hot loop: an entry whose test did not run keeps its stale head, so every idle drain re-runs it
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:26Z
updated: 2026-10-16T14:57:26Z
---

## Description
deferred.mjs:79 keeps an entry whose test did not run but never updates its head; deferred.mjs:59 re-triggers whenever head != HEAD; queue.mjs:63 calls recheck on every idle drain. Root daemon re-ran entries 7-16 continuously (lastrun.json 14:31:36-14:32:19Z, next 14:32:20Z; deferred-0..6.log rewritten 14:41-14:45Z and 14:49-14:50Z) with 'no tests to run' / 'failed to parse filterset'. Consequence of the KIT-T516 narrowing: deferred entry 16 (-p sim --lib) selects 0 tests forever. Source: broker-vetting-2026-10-16 D1. Test: a 0-test entry rechecked twice with no HEAD move spawns its command once.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T017, KIT-T310, KIT-T488

## History
- [2026-10-16 14:57] (created) bug — broker deferred recheck is a hot loop: an entry whose test did not run keeps its stale head, so every idle drain re-runs it
