---
id: KIT-T475
title: broker affected.mjs: a deleted src/bin/<b>.rs maps to --bin <b>, so landing the deletion fails with 'no bin target named <b>'; skip deleted
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T09:16:43Z
updated: 2026-10-14T15:19:41Z
---

## Description
broker affected.mjs: a deleted src/bin/<b>.rs maps to --bin <b>, so landing the deletion fails with 'no bin target named <b>'; skip deleted paths for --bin/--test picks (repro: dirt-empire DE-T036 job j-mv7w2o0d-8phfaq)

kit-bug-shape: cap:bug:broker-affected-mjs-a-deleted-src-bin-b-rs-maps-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A deleted src/bin/<b>.rs, tests/<t>.rs or src/lib.rs picks no target; a live one still does (affected.test.mjs, landgate.test.mjs; 389bae9)

## Plan
1.

## History
- [2026-10-14 09:16] (created) bug — broker affected.mjs: a deleted src/bin/<b>.rs maps to --bin <b>, so landing the deletion fails with 'no bin target named <b>'; skip deleted
- [2026-10-14 15:19] (comment) criterion added: A deleted src/bin/<b>.rs, tests/<t>.rs or src/lib.rs picks no target; a live one still does (affected.test.mjs, landgate.test.mjs; 389bae9)
- [2026-10-14 15:19] (comment) ticked: A deleted src/bin/<b>.rs, tests/<t>.rs or src/lib.rs picks no target; a live one still does (affected.test.mjs, landgate.test.mjs; 389bae9)
- [2026-10-14 15:19] (comment) @claude: Fixed 389bae9: selectAffected takes the plan's deleted paths; a deleted target root picks nothing and --lib needs a live (full comment #1 in ## Notes)
### comment #1 [2026-10-14 15:19] @claude
Fixed 389bae9: selectAffected takes the plan's deleted paths; a deleted target root picks nothing and --lib needs a live src/lib.rs. 143 broker tests pass; reverting the bin guard fails the landing test.
- [2026-10-14 15:19] (status) todo → review
