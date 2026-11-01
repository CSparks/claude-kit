---
id: KIT-T808
title: request-gate request-capture false-positive: a turn that routed the request with t decide --file (MAR-D013 written this turn) was still flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T21:54:14Z
updated: 2026-11-01T21:57:26Z
---

## Description
request-gate request-capture false-positive: a turn that routed the request with t decide --file (MAR-D013 written this turn) was still flagged un-captured; a decision written this turn must count as the capture

kit-bug-shape: cap:bug:request-gate-request-capture-false-positive-a-tu
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix: hooks/request-gate.mjs CAPTURE_STORES now also counts decisions, requests and questions written this turn (tickets still excluded). Test: hooks/request-gate.test.mjs ALL PASS (decisions and requests release, ticket-only still blocks). Also fixes KIT-T655.

## History
- [2026-11-01 21:54] (created) bug — request-gate request-capture false-positive: a turn that routed the request with t decide --file (MAR-D013 written this turn) was still flag
- [2026-11-01 21:57] (status) todo → review
