---
id: KIT-T898
title: q gates <agent|question>: print every requirement and exact accepted tag form of a gate, derived from the gate code; orient identity line points at it (KIT-D147)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T18:51:37Z
updated: 2026-11-08T19:53:14Z
---

## Description
Preflight so a session reads a gate's protocol before its first call (KIT-D147). Single source for escape tokens (hooks/lib/gate-tokens.mjs); dispatch-guard and question gates print every missing requirement on the first rejection.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q gates agent|question prints every requirement and exact tag form from the gate code; orient identity block points at it; each gate lists all failed requirements on the first rejection (hooks/gate-protocol.test.mjs 33 passed, question-gate 4b)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T047, KIT-T894
Single sources: hooks/lib/gate-tokens.mjs (every tag: name, form, meaning, pattern; the gates match the pattern, q gates prints the form, a test proves each form satisfies its pattern and that no gate keeps a local tag regex), hooks/lib/question-checks.mjs (check ids and thresholds), hooks/lib/gate-protocol.mjs (GATES registry: check ids imported from the enforcing modules, brief standard from question-brief.mjs; a test fails when a check dispatch-guard runs is not listed). Verified first-rejection completeness: dispatch-guard collects every block (test: no job + worktree in one message), question-brief-gate lists ready + brief parts in one message (test), question-gate stopped at the first bad question and now lists every one (fixed, test 4b). Rejections of dispatch-guard, question-gate and question-brief-gate end with a pointer to q gates. Orient adds one line (budget test KIT-T071 leaves ~100 chars of headroom: the line is 66 chars). Tests: gate-protocol 33, question-gate all pass, orient 39, dispatch-* and question-* modules pass; dispatch-guard 3 stale-table failures belong to another session's uncommitted KIT-D143 hunk in hooks/dispatch-guard.mjs (left unstaged).

## History
- [2026-11-08 18:51] (created) feature — q gates <agent|question>: print every requirement and exact accepted tag form of a gate, derived from the gate code; orient identity line points at it (KIT-D147)
- [2026-11-08 19:13] (comment) criterion added: q gates agent|question prints every requirement and exact tag form from the gate code; orient identity block points at it; each gate lists all failed requirements on the first rejection (hooks/gate-protocol.test.mjs 33 passed, question-gate 4b)
- [2026-11-08 19:13] (comment) ticked: q gates agent|question prints every requirement and exact tag form from the gate code; orient identity block points at it; each gate lists all failed requirements on the first rejection (hooks/gate-protocol.test.mjs 33 passed, question-gate 4b)
- [2026-11-08 19:13] (landed) 9b8867c q gates agent|question prints every requirement and exact tag form from the gate code (gate-tokens, question-checks, gat
- [2026-11-08 19:49] (landed) 9e260f8 orient budget test prints its length and, over budget, the whole output [no-log: test diagnostics for the KIT-T071 budge
- [2026-11-08 19:52] (landed) b6d47e6 orient budget test measures the content, not the length of the test's own temp path (published suite failed 4239 vs 4200
- [2026-11-08 19:53] (status) todo → review
