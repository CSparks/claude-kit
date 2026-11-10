---
id: KIT-T655
title: request-gate false positive: a request filed with 't request' (.ai/requests/MAR-R001-*.md, marblequest 2026-10-27) is not counted as a captu
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T927
created: 2026-10-27T21:59:49Z
updated: 2026-11-01T21:57:27Z
---

## Description
request-gate false positive: a request filed with 't request' (.ai/requests/MAR-R001-*.md, marblequest 2026-10-27) is not counted as a capture; the Stop hook still flags the prompt as un-captured. The gate should count writes to .ai/requests/.

kit-bug-shape: cap:bug:request-gate-false-positive-a-request-filed-with
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed with KIT-T808: .ai/requests counts as a capture store. Test hooks/request-gate.test.mjs.
### comment #1 [2026-11-10 00:06] @kit-agent
Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch carrying the maintainer's words as routing, and never re-nudges a prompt an earlier Stop found routed.

## History
- [2026-10-27 21:59] (created) bug — request-gate false positive: a request filed with 't request' (.ai/requests/MAR-R001-*.md, marblequest 2026-10-27) is not counted as a captu
- [2026-11-01 21:57] (status) todo → review
- [2026-11-01 21:57] (landed) 4783974 fix: decisions and requests count as request captures; level-generation briefs are not UI work (implements KIT-T808, KIT
- [2026-11-10 00:06] (status) review → superseded (by KIT-T927)
- [2026-11-10 00:06] (comment) @kit-agent: Duplicate of KIT-T927: the gate now counts cap, t new/request/note/question/comment/criterion/decide, and a dispatch car (full comment #1 in ## Notes)
