---
id: KIT-T604
title: Capability row resting on a maintainer decision could never be re-dated, so it went stale every 7 days and blocked every dispatch (asset row, 2026-10-20)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T05:07:53Z
updated: 2026-10-21T07:40:39Z
fixed_commit: 1149758
---

## Description
job-capability redate refused a row with no A/B/C source; the error said A/B/C only and no verb recorded a maintainer decision. Fixed: dated M basis grades, job-capability.mjs decide <date> <job> --by --on --quote writes the M row and re-dates it (KIT-D100).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T433, KIT-T419, KIT-T339

## History
- [2026-10-21 05:07] (created) bug — Capability row resting on a maintainer decision could never be re-dated, so it went stale every 7 days and blocked every dispatch (asset row, 2026-10-20)
- [2026-10-21 07:40] (status) todo → review
- [2026-10-21 07:40] (comment) dated M basis + job-capability.mjs decide; tests scripts/job-capability.test.mjs 24, capability-research 9, model-refresh 24; published 1149758; capabilityStatus from the runtime copy: stale false
