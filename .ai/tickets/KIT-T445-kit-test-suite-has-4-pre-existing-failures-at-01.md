---
id: KIT-T445
title: Kit test suite has 4 pre-existing failures at 011a13d (confirmed on a git-archive export of the prior commit by the KIT-T392 writer, 2026-10
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T07:22:55Z
updated: 2026-10-13T08:13:52Z
---

## Description
Kit test suite has 4 pre-existing failures at 011a13d (confirmed on a git-archive export of the prior commit by the KIT-T392 writer, 2026-10-13): scripts/db-cache.test.mjs (2 failed, similar-parity), hooks/dispatch-broker.test.mjs, hooks/activity-tag.test.mjs (1 failed), node --test server/server.test.mjs. None are in the q or gate code paths. A red kit suite hides new regressions; fix or quarantine each with its reason.

kit-bug-shape: cap:bug:kit-test-suite-has-4-pre-existing-failures-at-01
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] npm test chain is green command by command (98 commands, 0 failing) with each former failure fixed in code or test with its provenance

## Plan
1.

## History
- [2026-10-13 07:22] (created) bug — Kit test suite has 4 pre-existing failures at 011a13d (confirmed on a git-archive export of the prior commit by the KIT-T392 writer, 2026-10
- [2026-10-13 08:13] (comment) criterion added: npm test chain is green command by command (98 commands, 0 failing) with each former failure fixed in code or test with its provenance
- [2026-10-13 08:13] (comment) ticked: npm test chain is green command by command (98 commands, 0 failing) with each former failure fixed in code or test with its provenance
- [2026-10-13 08:13] (comment) @claude: Verdicts. (1) db-cache similar-parity x2: test fixed; KIT-T353 (2b206ff) deliberately added a bm25 score to the cache pa (full comment #1 in ## Notes)
### comment #1 [2026-10-13 08:13] @claude
Verdicts. (1) db-cache similar-parity x2: test fixed; KIT-T353 (2b206ff) deliberately added a bm25 score to the cache path of similar for t new dedup, the scan has none; parity now compares cache rows without score and asserts the score is present (scripts/db-cache.test.mjs 66 passed). (2) dispatch-broker x3: test fixed; KIT-T432/D090 holds a read-only dispatch to the research default, the test sent job build on opus for patch-worker and [read-only] cases; those now send research on sonnet (hooks/dispatch-broker.test.mjs, 12 PASS). (3) activity-tag: code fixed plus test; f64e051 (KIT-T419) moved local-qwen from job.fallback to job.alternate so model-tag knownFamilies stopped recognizing a hand-written [local-qwen] tag; it now reads family, alternate and fallback (hooks/model-tag.mjs); the expected label moves to Haiku 5.5 because the same commit repointed the haiku alias (hooks/activity-tag.test.mjs 29 passed). (4) server.test.mjs: environment, not code; server/node_modules was empty (express and cors never installed on this machine); npm ci in server/ fixes it, 29 passed. Chain: 98 commands, 0 failing.
- [2026-10-13 08:13] (status) todo → review
