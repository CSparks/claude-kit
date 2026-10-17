---
id: KIT-T554
title: Process failure: a recorded directive was implemented against itself and nothing caught it. Chris 2026-10-15 (KIT-T482#14/#15): the broker b
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T17:56:40Z
updated: 2026-10-17T18:56:49Z
---

## Description
Process failure: a recorded directive was implemented against itself and nothing caught it. Chris 2026-10-15 (KIT-T482#14/#15): the broker brokers writes per repo, never across the board; not an issue for non-rust. The SAME commit that implemented it (bcfa61d, KIT-D096) added a machine-wide push lock keyed by remote URL (scripts/broker/pushlock.mjs) so checkouts in different directories wait on each other, and D096's text says a submodule queue is 'shared by every checkout that pushes it'. Chris had to restate it 2026-10-17. Root cause: decisions are prose with no enforcing test; the implementer can contradict one without any gate failing. Fix: a directive decision carries enforced_by: <test paths>; a commit gate refuses a decision marked directive with no existing enforced_by test, and orient lists directive decisions with none. KIT-T553 retrofits the broker case.

Checked as possible duplicates and judged different work (--not-dup): KIT-T553

kit-bug-shape: cap:bug:process-failure-a-recorded-directive-was-impleme
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Gate built: hooks/lib/directive.mjs (directive: true needs enforced_by with existing paths), commit-gate.mjs check id directive-enforced, orient.mjs lists DIRECTIVES WITHOUT A TEST. Backfilled KIT-D097 (enforced_by: scope-invariants, push-race, build-scope, dispatch-broker tests). Tests: hooks/commit-gate.test.mjs 42 passed (4 new: no enforced_by blocks, missing test blocks, existing test commits, non-directive control), hooks/orient.test.mjs 31 passed (3 new). Not covered: KIT-D096 and older directives stay unmarked.
(fixed) 644e64d

## History
- [2026-10-17 17:56] (created) bug — Process failure: a recorded directive was implemented against itself and nothing caught it. Chris 2026-10-15 (KIT-T482#14/#15): the broker b
- [2026-10-17 17:56] (comment) @claude: Recurrence of KIT-T507 (2026-10-15, same directive, same broker). T507 root cause (3) 'nothing checks a design against r (full comment #1 in ## Notes)
### comment #1 [2026-10-17 17:56] @claude
Recurrence of KIT-T507 (2026-10-15, same directive, same broker). T507 root cause (3) 'nothing checks a design against recorded directives' went to review without a gate; this ticket is that gate. Third statement of the rule by Chris.
- [2026-10-17 18:56] (status) todo → review
