---
id: KIT-T385
title: request-gate false positive: a request routed via 't criterion ST-T607 ...' plus 't comment ST-T607 ...' (stiletto 2026-10-07) still fired '
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T927
created: 2026-10-07T18:10:26Z
updated: 2026-10-07T18:10:26Z
---

## Description
request-gate false positive: a request routed via 't criterion ST-T607 ...' plus 't comment ST-T607 ...' (stiletto 2026-10-07) still fired 'possible un-captured request'; ticket criterion/comment writes through t.mjs should count as capture.

kit-bug-shape: cap:bug:request-gate-false-positive-a-request-routed-via
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 18:10] (created) bug — request-gate false positive: a request routed via 't criterion ST-T607 ...' plus 't comment ST-T607 ...' (stiletto 2026-10-07) still fired '
- [2026-11-10 00:05] (status) todo → superseded (by KIT-T927)
- [2026-11-10 00:05] (comment) @kit-agent: Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch car (full comment #1 in ## Notes)
### comment #1 [2026-11-10 00:05] @kit-agent
Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch carrying the maintainer's words as routing, and never re-nudges a prompt an earlier Stop found routed.
