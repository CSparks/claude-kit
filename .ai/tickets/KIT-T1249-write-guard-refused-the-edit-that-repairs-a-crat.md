---
id: KIT-T1249
title: write guard refused the edit that repairs a crate the same agent left half edited: builds --wait returned free, another writer's build started within seconds, the repair was refused four times while every other check failed (road-generator fences agent, rg-townplan, 2026-11-15)
type: bug
status: superseded
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by: KIT-T1245
created: 2026-11-15T09:13:55Z
updated: 2026-11-15T09:13:55Z
---

## Description
Same cause as KIT-T1245/KIT-T1247 and the symptom of KIT-T1222, but its own failure: the guard blocks the REPAIR. Fix in KIT-T1245: a crate marked broken by a failed check no longer refuses its last writer's edit; a refusal mid-change names every crate the writer left unchecked or broken.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1245, KIT-T1222, KIT-T1247

## History
- [2026-11-15 09:13] (created) bug — write guard refused the edit that repairs a crate the same agent left half edited: builds --wait returned free, another writer's build started within seconds, the repair was refused four times while every other check failed (road-generator fences agent, rg-townplan, 2026-11-15)
- [2026-11-15 09:14] (status) todo → superseded (by KIT-T1245)
