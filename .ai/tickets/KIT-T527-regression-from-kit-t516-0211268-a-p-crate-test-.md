---
id: KIT-T527
title: REGRESSION from KIT-T516 (0211268): a '-p <crate>' test composed from the 'cargo t' alias now runs 'cargo nextest run --features fastdev -p
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T19:45:36Z
updated: 2026-10-15T19:45:36Z
---

## Description
REGRESSION from KIT-T516 (0211268): a '-p <crate>' test composed from the 'cargo t' alias now runs 'cargo nextest run --features fastdev -p workspace-guards', and cargo refuses: the package workspace-guards does not contain feature fastdev (only editor and stiletto do). Before T516 the same --test 'cargo t -p workspace-guards' passed (G3 3b417016). When the alias carries --features F and the expansion narrows to -p P, the feature must be package-qualified (--features <alias-owner>/F, here stiletto/fastdev) or dropped for packages lacking it; the feature set must stay identical to the alias so no artifact is invalidated (ST-T574). Job j-mv9y4x97 (stiletto pin + G1 rows) red at run, 5.8 s --priority high

kit-bug-shape: cap:bug:regression-from-kit-t516-0211268-a-p-crate-test-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 19:45] (created) bug — REGRESSION from KIT-T516 (0211268): a '-p <crate>' test composed from the 'cargo t' alias now runs 'cargo nextest run --features fastdev -p
- [2026-10-16 14:58] (comment) @claude: Vetting 2026-10-16: fix 45d4937 has had NO root job since, so it is unproven on a root job. Also the T516 narrowing chan (full comment #1 in ## Notes)
### comment #1 [2026-10-16 14:58] @claude
Vetting 2026-10-16: fix 45d4937 has had NO root job since, so it is unproven on a root job. Also the T516 narrowing changed recorded deferred commands: deferred entry 16 (-p sim --lib) now selects 0 tests forever (see the deferred hot-loop ticket KIT-T539). Leave open until a root '-p <crate>' job with a feature alias passes.
