---
id: KIT-T704
title: Agent no-wait and context-ceiling enforcement (KIT-D115, KIT-D116) - held
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:49:11Z
updated: 2026-10-29T17:55:27Z
---

## Description
Build the agent no-wait / context-ceiling enforcement per KIT-D115 and KIT-D116. HELD by the coordinator on 2026-10-29 ("design needs rethinking"). Nothing published.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Design settled with Chris (KIT-D115 wording and KIT-D116 ceiling reviewed; both decisions are provisional)
- [x] Patch-worker skill, agent definition and docs: submit, hand back with job ids, no wait
- [x] Enforcement (subagent-only hook, broker scripts refusing in a subagent, SubagentStop kill and report, orient and dispatch guard rule injection and ceiling flag)
- [x] Per-job finished line (job id, verdict, agent id, ticket) in target/broker/finished.log, agent id recorded on the job
- [x] A test with a negative control per layer

## Plan
1.

## Notes
State at hold (nothing committed, nothing published):
- Written: .ai/decisions/KIT-D115 (no wait over 5 minutes, handoff, orchestrator resumes) and KIT-D116 (context ceiling 200k, amends KIT-D077 and KIT-D094; the 200k is the orchestrator's default, open to Chris). dirt-empire DE-D062 set to `promoted: KIT-D115`. KIT-D115 does not yet list the four enforcement layers the coordinator sent afterwards.
- Written, untracked, unused: hooks/lib/subagent-id.mjs (subagentId(payload)) and hooks/lib/broker-calls.mjs (brokerCalls, usesCargo); no tests, not wired.
- Item 5 (daemon restart mid-job) is not a gap: scripts/broker/broker.mjs tick() swaps runtime only after a synchronous drain (publishedSwap, KIT-T500), so a restart never interrupts a job. Dropped.
- Findings for the design: roster `tokens` on a done row is the last request's total (hooks/agent-outcome.mjs); orphan background shells are already reported and killed at SubagentStop (hooks/orphan-shells.mjs, hooks/lib/task-kill.mjs skips broker commands); job and result files already carry `session` (scripts/broker/rr.mjs, result.mjs); resume-check.mjs is the SendMessage hook; orient.mjs is 630 lines, so orient changes go through lib/agent-format.mjs.
Built per KIT-D115 (one bounded wait allowed; polling/loops/background waits/re-run banned), KIT-D116 (context ceiling 200k + handoff in ticket Notes), KIT-D118 (precheck off-queue + submit-time write gate, mtime-aligned check tree, measurement lane, linked jobs wait for their auto-pin). Item 5 (daemon restart mid-job) is not a gap: broker.mjs swaps runtime only after a drain (publishedSwap, KIT-T500). Hooks: broker-wait-gate, broker-agent-tag (subagents only), resume-check blocks past-ceiling resumes, dispatch-guard handoff-before-replace + ceiling warning, activity-tag appends the no-wait rule to patch-worker briefs, SubagentStop RETIRE line and broker-wait kill, wait-poll ignores finished outputs and counts per agent. Evidence: hooks/broker-wait-gate.test.mjs 46, hooks/agent-context.test.mjs 29, hooks/wait-poll.test.mjs 26, hooks/task-kill.test.mjs 13, scripts/broker/{agent,precheck,measure,mtime-align,linked-order}.test.mjs + gate/idle tests; 65 + 43 + 58 existing broker tests green. Cold/warm: synthetic 30-crate workspace, fresh worktree 43.4 s before, 0.36 s after mtime alignment; live cold 37.0 s.

## History
- [2026-10-29 16:49] (created) feature — Agent no-wait and context-ceiling enforcement (KIT-D115, KIT-D116) - held
- [2026-10-29 17:55] (comment) ticked: Design settled with Chris (KIT-D115 wording and KIT-D116 ceiling reviewed; both decisions are provisional)
- [2026-10-29 17:55] (comment) ticked: Patch-worker skill, agent definition and docs: submit, hand back with job ids, no wait
- [2026-10-29 17:55] (comment) ticked: Enforcement (subagent-only hook, broker scripts refusing in a subagent, SubagentStop kill and report, orient and dispatch guard rule injection and ceiling flag)
- [2026-10-29 17:55] (comment) ticked: Per-job finished line (job id, verdict, agent id, ticket) in target/broker/finished.log, agent id recorded on the job
- [2026-10-29 17:55] (comment) ticked: A test with a negative control per layer
- [2026-10-29 17:55] (status) todo → review
