---
id: KIT-T655
title: request-gate false positive: a request filed with 't request' (.ai/requests/MAR-R001-*.md, marblequest 2026-10-27) is not counted as a captu
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
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

## History
- [2026-10-27 21:59] (created) bug — request-gate false positive: a request filed with 't request' (.ai/requests/MAR-R001-*.md, marblequest 2026-10-27) is not counted as a captu
- [2026-11-01 21:57] (status) todo → review
