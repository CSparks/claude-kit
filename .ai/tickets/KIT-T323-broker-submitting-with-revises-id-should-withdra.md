---
id: KIT-T323
title: broker: submitting with --revises <id> should withdraw <id> if it is still QUEUED (not running), and there should be a 'broker cancel <id>'
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T19:16:02Z
updated: 2026-10-04T19:18:45Z
---

## Description
broker: submitting with --revises <id> should withdraw <id> if it is still QUEUED (not running), and there should be a 'broker cancel <id>' for a queued job. Today the superseded job (e.g. stiletto j-muu7b13p-quvcmc, replaced by j-muu7b7v1-6gxlka after a filter typo) still runs a full ~10-minute build/test cycle that nobody wants.

kit-bug-shape: cap:feature:broker-submitting-with-revises-id-should-withdra
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] submit --revises withdraws a queued predecessor (result: superseded by <new id>); broker cancel <id> cancels a queued job and refuses a running one

## Plan
1.

## History
- [2026-10-04 19:16] (created) feature — broker: submitting with --revises <id> should withdraw <id> if it is still QUEUED (not running), and there should be a 'broker cancel <id>'
- [2026-10-04 19:18] (comment) criterion added: submit --revises withdraws a queued predecessor (result: superseded by <new id>); broker cancel <id> cancels a queued job and refuses a running one
- [2026-10-04 19:18] (comment) ticked: submit --revises withdraws a queued predecessor (result: superseded by <new id>); broker cancel <id> cancels a queued job and refuses a running one
- [2026-10-04 19:18] (comment) @sonnet55: scripts/broker/withdraw.mjs withdrawJob (writes the final result, removes the queue file, refuses when inflight.json nam (full comment #1 in ## Notes)
### comment #1 [2026-10-04 19:18] @sonnet55
scripts/broker/withdraw.mjs withdrawJob (writes the final result, removes the queue file, refuses when inflight.json names the job); submit.mjs --revises and broker.mjs cancel use it; queue.mjs skips a job withdrawn since its listing; STATUS gains superseded/cancelled; wait returns promptly with the status. Tests: scripts/broker/withdraw.test.mjs (5 incl. running refused, unknown/finished refused, plain submit withdraws nothing); mutation (no running check) fails 2. Broker suite 112 passed.
- [2026-10-04 19:18] (status) todo → review
