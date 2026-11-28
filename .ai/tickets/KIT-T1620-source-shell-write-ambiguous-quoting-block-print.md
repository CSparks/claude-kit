---
id: KIT-T1620
title: source-shell-write ambiguous-quoting block prints no reason, span or trigger word (hooks/lib/shell-source-write.mjs:49 drops them), so agent
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T1619
created: 2026-11-28T16:41:25Z
updated: 2026-11-28T16:47:48Z
---

## Description
source-shell-write ambiguous-quoting block prints no reason, span or trigger word (hooks/lib/shell-source-write.mjs:49 drops them), so agents capture the wrong cause (KIT-T1618 was misfiled); the block must name the unresolved quote construct, the operator and the write word it saw

kit-bug-shape: cap:bug:source-shell-write-ambiguous-quoting-block-print:f671fb9a
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-28 16:41] (created) bug — source-shell-write ambiguous-quoting block prints no reason, span or trigger word (hooks/lib/shell-source-write.mjs:49 drops them), so agent
- [2026-11-28 16:47] (status) todo → superseded (by KIT-T1619)
- [2026-11-28 16:47] (status) superseded → superseded
