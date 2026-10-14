---
id: KIT-T438
title: t comment --agent claude is ignored: 'node t.mjs comment RG-T003 "..." --agent claude' stamped the comment as @chris (RG-T003#2, 2026-10-12)
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T02:37:26Z
updated: 2026-10-13T02:52:07Z
---

## Description
t comment --agent claude is ignored: 'node t.mjs comment RG-T003 "..." --agent claude' stamped the comment as @chris (RG-T003#2, 2026-10-12), misattributing an agent-written note to the maintainer; the flag must set the author or the command must refuse an unknown flag.

kit-bug-shape: cap:bug:t-comment-agent-claude-is-ignored-node-t-mjs-com
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 02:37] (created) bug — t comment --agent claude is ignored: 'node t.mjs comment RG-T003 "..." --agent claude' stamped the comment as @chris (RG-T003#2, 2026-10-12)
- [2026-10-13 02:52] (comment) @claude: Retracted: not a kit bug. The flag is --author (t --help); I passed --agent, which the parser ignored. Real gap, if any: t should refuse an unknown flag instead of silently defaulting the author.
- [2026-10-13 02:52] (status) todo → superseded
