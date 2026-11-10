---
id: KIT-T931
title: Process failure: dispatched agent type 'claude' without [job: id] and non-canonical label; hooks KIT-T419/T897 blocked. Prevention: every di
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T04:47:56Z
updated: 2026-11-10T19:21:19Z
---

## Description
Process failure: dispatched agent type 'claude' without [job: id] and non-canonical label; hooks KIT-T419/T897 blocked. Prevention: every dispatch carries [job: id] and '[Model x.y] label' from the start.

Checked as possible duplicates and judged different work (--not-dup): KIT-T719

kit-bug-shape: cap:bug:process-failure-dispatched-agent-type-claude-wit
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 04:47] (created) bug — Process failure: dispatched agent type 'claude' without [job: id] and non-canonical label; hooks KIT-T419/T897 blocked. Prevention: every di
- [2026-11-10 19:20] (comment) @claude: Already fixed: the checklist and the hooks that enforce it. dispatch-label (KIT-T897) names the '[Family N.M] label' tag (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:20] @claude
Already fixed: the checklist and the hooks that enforce it. dispatch-label (KIT-T897) names the '[Family N.M] label' tag and dispatch-job demands [job: id]; both are printed by 'q gates agent'; 61018ae (plugin 0.1.37) loads the dispatch checklist into sessions (contract-rules.test.mjs asserts [job: <id>] and the label form in the contract, commands/work.md and commands/drain.md).
- [2026-11-10 19:21] (status) todo → review
