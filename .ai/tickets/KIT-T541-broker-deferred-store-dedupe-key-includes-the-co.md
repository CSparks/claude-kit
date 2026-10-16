---
id: KIT-T541
title: broker deferred store: dedupe key includes the command so one test is stored several times, green entries are only dropped by a recheck pass, and status prints the dirty-path list per entry
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:48Z
updated: 2026-10-16T14:57:48Z
---

## Description
deferred.mjs:27 key includes the command (crystal facets 0,3,5; shader-kit tiles 2,4,6; material_recipe 7,15; entrance assemblies 8,16). deferredLines (deferred.mjs:94) prints the 12 dirty paths per entry so broker status is a wall of text. Entries 12,13,14 passed in j-mv9q1h48 logs but only a recheck pass drops an entry (deferred.mjs:78). Fix: dedupe by test key, prune entries proven green, status = count + one line per test. Source: broker-vetting-2026-10-16 D3.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T270, KIT-T440, KIT-T539

## History
- [2026-10-16 14:57] (created) bug — broker deferred store: dedupe key includes the command so one test is stored several times, green entries are only dropped by a recheck pass, and status prints the dirty-path list per entry
