---
id: KIT-T1361
title: implementation agent (road-generator mountain job, 2026-11-18), fourth block, one-file-search: grep on a named probe output file under targe
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T00:45:17Z
updated: 2026-11-18T02:56:43Z
fixed_commit: 7d036958
---

## Description
implementation agent (road-generator mountain job, 2026-11-18), fourth block, one-file-search: grep on a named probe output file under target/ after an earlier brief line said 'never grep, Read for logs'. Process failure of the agent, same family as KIT-T1360. Prevention for the agent definition: a script that produces a readout prints the lines wanted itself (its own output may be filtered inline), and a saved output file is opened with Read (offset, limit), never grep or tail.

Checked as possible duplicates and judged different work (--not-dup): KIT-T1360

kit-bug-shape: cap:bug:implementation-agent-road-generator-mountain-job:5aa6594b
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] docs/wait-rule.md and every agent definition say a saved output file is opened with Read (offset, limit), never grep, tail or cat, and a script prints the readout lines itself (hooks/agent-recipes.test.mjs); plugin version 0.1.57 so the agent text reaches sessions

## Plan
1.

## Notes
Cache state checked 2026-11-18: installed_plugins.json has claude-kit 0.1.56 (autoUpdate from the directory marketplace D:/dev/claude-kit, lastUpdated 2026-11-18T01:48Z); the cache dirs 0.1.51-0.1.56 hold only .agents and .ai (0.1.55 also .orphaned_at), no agents/ or hooks/. The harness loads this plugin from the directory marketplace itself: hook commands in transcripts run D:\dev\claude-kit/hooks/compat-run.mjs, so CLAUDE_PLUGIN_ROOT is the live checkout and agent text is read from D:/dev/claude-kit/agents at session start. A session started before an agent change keeps its old agent text and hook wiring (session 4100d9bf shows no heartbeat for claims-release-gate). So the owner restarts the session to take new agent text and hooks; plugin version bumped to 0.1.57 (publish refuses agent text drift under an unchanged version, KIT-T1071).

## History
- [2026-11-18 00:45] (created) bug — implementation agent (road-generator mountain job, 2026-11-18), fourth block, one-file-search: grep on a named probe output file under targe
- [2026-11-18 02:54] (status) todo → doing
- [2026-11-18 02:54] (comment) criterion added: docs/wait-rule.md and every agent definition say a saved output file is opened with Read (offset, limit), never grep, tail or cat, and a script prints the readout lines itself (hooks/agent-recipes.test.mjs); plugin version 0.1.57 so the agent text reaches sessions
- [2026-11-18 02:54] (comment) ticked: docs/wait-rule.md and every agent definition say a saved output file is opened with Read (offset, limit), never grep, tail or cat, and a script prints the readout lines itself (hooks/agent-recipes.test.mjs); plugin version 0.1.57 so the agent text reaches sessions
- [2026-11-18 02:56] (landed) 7d036958 wait.mjs reads a builds --run id once instead of answering unknown job; the broker-wait block and the wait rule name ONE
- [2026-11-18 02:56] (status) doing → review
- [2026-11-18 02:56] (comment) runtime 7d036958 published, plugin 0.1.57
