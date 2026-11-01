---
id: KIT-T702
title: D:/dev/claude-kit/tools/llm-fleet/ (fleet.ps1 and convert-asset.mjs, dated 2026-08-31) has never been committed: it sits untracked in the ki
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:15:24Z
updated: 2026-10-29T16:15:24Z
parent: KIT-T350
---

## Description
D:/dev/claude-kit/tools/llm-fleet/ (fleet.ps1 and convert-asset.mjs, dated 2026-08-31) has never been committed: it sits untracked in the kit tree. The security review flagged fleet.ps1:83: it builds a powershell -Command string by joining lane.name, lane.src and config.example from the lanes JSON plus an unquoted $Repo. Anyone who controls that JSON can inject commands, and a repo path containing a space breaks it. Decide whether to keep it (commit it with an argument-array launch, wt new-tab node <args>, nothing passed through -Command) or delete it as dead (check whether scripts/local-agent.mjs superseded it).

kit-bug-shape: cap:bug:d-dev-claude-kit-tools-llm-fleet-fleet-ps1-and-c
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 16:15] (created) bug — D:/dev/claude-kit/tools/llm-fleet/ (fleet.ps1 and convert-asset.mjs, dated 2026-08-31) has never been committed: it sits untracked in the ki
- [2026-10-29 19:25] (comment) @claude: The security review re-flagged this on 2026-10-29 as HIGH. Suggested fix: a run-lane.ps1 launcher with named params (Rep (full comment #1 in ## Notes)
### comment #1 [2026-10-29 19:25] @claude
The security review re-flagged this on 2026-10-29 as HIGH. Suggested fix: a run-lane.ps1 launcher with named params (Repo, LaneName, LaneSrc, Example, Kit), launched via 'powershell -File run-lane.ps1 -Repo … -LaneName …' as separate argv elements, so no -Command string is built from lanes JSON values.
