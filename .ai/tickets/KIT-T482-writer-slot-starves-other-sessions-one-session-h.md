---
id: KIT-T482
title: Writer slot starves other sessions: one session held the stiletto writer slot ~21 h across a 5-lane queue while another waited; needs a per-landing slot lease with a visible queue, then concurrent writers in ONE checkout without copies
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T18:35:51Z
updated: 2026-10-14T18:35:51Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T270, KIT-T276, KIT-T351
### comment #1 [2026-10-14 18:36] @claude
Chris 2026-10-14 13:30, verbatim: 'That shit needs to be optimized. This is tedious as fuck and not conducive to agentic development on the same machine without making a gazillion different fucking repo copies and a gazzillion different builds wasting tons of time, CPU, and space.' Causes (stiletto record): (1) the slot is held per QUEUE, not per landing (2a held it 2026-10-13 16:05 -> 10-14 for N037 L1, N036, L2, L3, gate, L7, L6, L4 with S6/L5a still queued; SESSION.md line 2); (2) no slot tool: handover is prose in SESSION.md, so nothing shows the queue or the age of the hold; (3) the build broker (KIT-T270/T276, docs/BROKER.md: one daemon applies queued patches, one target dir, many read-only workers) is kept down by ST-D228 after an agent spent ~200 min in serial broker waits (stiletto SESSION 2026-10-04, KIT-T326); (4) the rapid-game pre-push gate refuses any dirty rust/, so one writer's uncommitted work blocks every other writer's push, and the full lane takes ~17 min. Copies are ruled out (KIT-D039) and cost ~500 GB of targets each.

## History
- [2026-10-14 18:35] (created) feature — Writer slot starves other sessions: one session held the stiletto writer slot ~21 h across a 5-lane queue while another waited; needs a per-landing slot lease with a visible queue, then concurrent writers in ONE checkout without copies
- [2026-10-14 18:36] (comment) @claude: Chris 2026-10-14 13:30, verbatim: 'That shit needs to be optimized. This is tedious as fuck and not conducive to agentic (full comment #1 in ## Notes)
