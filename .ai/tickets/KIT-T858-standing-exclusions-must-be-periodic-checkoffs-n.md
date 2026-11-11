---
id: KIT-T858
title: Standing exclusions must be periodic checkoffs, not one-time: each .claude-kit-ignore.yaml entry carries an owner-approved expiry (default 7
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T16:01:55Z
updated: 2026-11-05T16:01:55Z
---

## Description
Standing exclusions must be periodic checkoffs, not one-time: each .claude-kit-ignore.yaml entry carries an owner-approved expiry (default 7d); at expiry orient raises it as a questionnaire (keep/remove/extend) and the gate re-blocks until answered. Also: capability-table-stale guard must exempt the model-refresh dispatch, else it deadlocks on its own fix (dirt-empire 2026-11-04: every Agent dispatch blocked, successor-gate surfaced DE-T295 21x unanswered). Chris 2026-11-05: 'This needs to be a periodic checkoff, not a one-time checkoff. Today I'd say ignore. A week from now if Anthropic releases a new model, I'd probably answer different.'

kit-bug-shape: cap:feature:standing-exclusions-must-be-periodic-checkoffs-n
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-05 16:01] (created) feature — Standing exclusions must be periodic checkoffs, not one-time: each .claude-kit-ignore.yaml entry carries an owner-approved expiry (default 7
