---
id: KIT-T808
title: request-gate request-capture false-positive: a turn that routed the request with t decide --file (MAR-D013 written this turn) was still flag
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T927
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
### comment #1 [2026-11-10 00:06] @kit-agent
Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch carrying the maintainer's words as routing, and never re-nudges a prompt an earlier Stop found routed.

## History
- [2026-11-01 21:54] (created) bug — request-gate request-capture false-positive: a turn that routed the request with t decide --file (MAR-D013 written this turn) was still flag
- [2026-11-01 21:57] (status) todo → review
- [2026-11-01 21:57] (landed) 4783974 fix: decisions and requests count as request captures; level-generation briefs are not UI work (implements KIT-T808, KIT
- [2026-11-10 00:06] (status) review → superseded (by KIT-T927)
- [2026-11-10 00:06] (comment) @kit-agent: Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch car (full comment #1 in ## Notes)
