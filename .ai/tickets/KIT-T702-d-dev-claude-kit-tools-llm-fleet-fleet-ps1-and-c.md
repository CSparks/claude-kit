---
id: KIT-T702
title: D:/dev/claude-kit/tools/llm-fleet/ (fleet.ps1 and convert-asset.mjs, dated 2026-08-31) has never been committed: it sits untracked in the ki
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:15:24Z
updated: 2026-11-01T23:27:08Z
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

## Notes
Review only (2026-11-01), nothing deleted. tools/llm-fleet/ holds fleet.ps1 (84 lines) and convert-asset.mjs (154 lines), untracked, dated 2026-08-31. Findings: (1) nothing in the kit references either file (q code for llm-fleet, fleet.ps1, convert-asset finds only the two files themselves); the committed local-Qwen path is scripts/local-agent.mjs (bfd7523, KIT-D080). (2) fleet.ps1 line 83 builds a powershell -Command string from lane.name, lane.src, config.example and an unquoted Repo variable: command injection from the lanes JSON and breakage on a repo path with a space, as the security review said; it launches wt.exe tabs. (3) It is broken as it stands: it starts fleet-monitor.ps1 from the KitFleet directory, and that file is not in the directory. (4) convert-asset.mjs is a one-off for ST-T524 (stiletto Rust-mesh to .rhai port, model hard-coded to qwen3.8-27b, router 127.0.0.1:8080, usage text names scripts/convert-asset.mjs, a path that does not exist here). Recommendation: delete as dead (ST-T524 is the only consumer and it belongs in the stiletto repo if wanted); if the maintainer wants it kept, commit with an argument-array launch (wt new-tab node <args>, nothing through -Command). Maintainer decides.

## History
- [2026-10-29 16:15] (created) bug — D:/dev/claude-kit/tools/llm-fleet/ (fleet.ps1 and convert-asset.mjs, dated 2026-08-31) has never been committed: it sits untracked in the ki
- [2026-10-29 19:25] (comment) @claude: The security review re-flagged this on 2026-10-29 as HIGH. Suggested fix: a run-lane.ps1 launcher with named params (Rep (full comment #1 in ## Notes)
### comment #1 [2026-10-29 19:25] @claude
The security review re-flagged this on 2026-10-29 as HIGH. Suggested fix: a run-lane.ps1 launcher with named params (Repo, LaneName, LaneSrc, Example, Kit), launched via 'powershell -File run-lane.ps1 -Repo … -LaneName …' as separate argv elements, so no -Command string is built from lanes JSON values.
- [2026-11-01 23:27] (status) todo → review
