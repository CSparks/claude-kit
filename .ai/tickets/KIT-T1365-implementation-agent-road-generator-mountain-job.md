---
id: KIT-T1365
title: implementation agent (road-generator mountain job, 2026-11-18), fifth block, broker-wait: one Bash call chained builds --run with a tail -F
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T02:17:37Z
updated: 2026-11-18T02:54:11Z
---

## Description
implementation agent (road-generator mountain job, 2026-11-18), fifth block, broker-wait: one Bash call chained builds --run with a tail -F wait and a 350000 ms timeout. Process failure of the agent; earlier the same agent also waited with tail -F on finished.log and re-read builds --result on running runs. Root cause: the agent definition names the wait rule but not the one sanctioned wait command. Prevention: put the exact line in the implementation agent definition: after builds --run returns 'still running', wait ONCE with node <runtime>/scripts/broker/wait.mjs <id> --root <tree> --timeout 170, then hand off.

Checked as possible duplicates and judged different work (--not-dup): KIT-T1360, KIT-T1361

kit-bug-shape: cap:bug:implementation-agent-road-generator-mountain-job:8353bdd6
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the broker-wait block says plainly: ONE builds --run call with nothing chained, end the turn naming the run id, the orchestrator's Monitor on finished.log for the resume; docs/wait-rule.md and all 15 agent definitions carry the same lines (hooks/agent-recipes.test.mjs, detached-run.test.mjs)

## Plan
1.

## Notes
The block text and docs/wait-rule.md (carried verbatim by all 15 agent definitions, test-enforced by wait-poll and agent-recipes) now say: ONE builds --run "<command>" --out target/<file> --timeout 170 --tool-timeout 180 call with nothing chained; if still running end the turn naming the run id, output file and builds --result <id>; wait.mjs waits on broker jobs only; the orchestrator's Monitor on finished.log resumes. Plugin version 0.1.57 for the agent text.

## History
- [2026-11-18 02:17] (created) bug — implementation agent (road-generator mountain job, 2026-11-18), fifth block, broker-wait: one Bash call chained builds --run with a tail -F
- [2026-11-18 02:54] (status) todo → doing
- [2026-11-18 02:54] (comment) criterion added: the broker-wait block says plainly: ONE builds --run call with nothing chained, end the turn naming the run id, the orchestrator's Monitor on finished.log for the resume; docs/wait-rule.md and all 15 agent definitions carry the same lines (hooks/agent-recipes.test.mjs, detached-run.test.mjs)
- [2026-11-18 02:54] (comment) ticked: the broker-wait block says plainly: ONE builds --run call with nothing chained, end the turn naming the run id, the orchestrator's Monitor on finished.log for the resume; docs/wait-rule.md and all 15 agent definitions carry the same lines (hooks/agent-recipes.test.mjs, detached-run.test.mjs)
