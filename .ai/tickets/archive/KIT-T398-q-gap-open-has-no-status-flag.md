---
id: KIT-T398
title: q gap: 'open' has no --status flag
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T19:51:04Z
updated: 2026-10-27T22:27:25Z
---

## Description
q open --status todo

kit-bug-shape: q-gap:flag:open:--status
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 19:51] (created) bug — q gap: 'open' has no --status flag
- [2026-10-10 00:27] (status) todo → doing
- [2026-10-10 00:41] (comment) @claude: 2026-10-09 q open --status todo|doing|review (comma list, --status=x too) via scripts/q-open-args.mjs, shared by cache + (full comment #1 in ## Notes)
### comment #1 [2026-10-10 00:41] @claude
2026-10-09 q open --status todo|doing|review (comma list, --status=x too) via scripts/q-open-args.mjs, shared by cache + scan paths, documented in q --help, q-gap whitelists it. Test scripts/q-open.test.mjs 4 passed.
- [2026-10-10 00:41] (status) doing → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
