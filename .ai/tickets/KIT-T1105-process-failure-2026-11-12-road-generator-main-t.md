---
id: KIT-T1105
title: process failure 2026-11-12 (road-generator main thread), second of its kind today: an Agent dispatch named model opus for an agent whose def
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T19:35:40Z
updated: 2026-11-12T19:42:08Z
---

## Description
process failure 2026-11-12 (road-generator main thread), second of its kind today: an Agent dispatch named model opus for an agent whose default job (research) maps to sonnet in the capability table; dispatch-job and dispatch-escalation blocked it. Root cause: the orchestrator picks the model from the prose rules in CLAUDE.md and does not run the resolver before a dispatch. Prevention: 'q gates agent' prints, for the current project, each agent type's default job and its table family (or names the one command that resolves it: node scripts/dispatch-ladder.mjs resolve --job <job>), and the CLAUDE.md dispatch checklist says to resolve the family with it before every dispatch.

kit-bug-shape: cap:bug:process-failure-2026-11-12-road-generator-main-t
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q gates agent prints the capability table jobs (id, family, fallback, use) and each agent type's default job with its family, read from the table and the agent definitions
- [x] the printout names the resolver command in the runtime path form; dispatch-job's block uses the same constant
- [x] CLAUDE.global.md dispatch checklist says model is the job's table family and names the lookup
- [x] tests: known job and family from a fixture table, agent type default job, table change changes printout

## Plan
1.

## Notes
Landed 9dd5f5e. Jobs section built at print time from readLadder + definitionJob (hooks/lib/gate-jobs.mjs), outside GATES.checks so the compaction digest is unchanged (gate-digest 9 passed, 14-line budget untouched). Tests: gate-protocol 48, gate-digest 9, question-brief-turn 16, contract-rules 17, coordination-model 12, block-triage 13, search-adoption 7; dispatch-job, dispatch-guard, dispatch-framework 0 failures. Process failure noted: one source edit attempted through a node script was blocked by source-shell-write; redone with Write.

## History
- [2026-11-12 19:35] (created) bug — process failure 2026-11-12 (road-generator main thread), second of its kind today: an Agent dispatch named model opus for an agent whose def
- [2026-11-12 19:41] (comment) criterion added: q gates agent prints the capability table jobs (id, family, fallback, use) and each agent type's default job with its family, read from the table and the agent definitions
- [2026-11-12 19:41] (comment) criterion added: the printout names the resolver command in the runtime path form; dispatch-job's block uses the same constant
- [2026-11-12 19:41] (comment) criterion added: CLAUDE.global.md dispatch checklist says model is the job's table family and names the lookup
- [2026-11-12 19:41] (comment) criterion added: tests: known job and family from a fixture table, agent type default job, table change changes printout
- [2026-11-12 19:41] (status) todo → doing
- [2026-11-12 19:41] (landed) 9dd5f5e q gates agent prints the capability table's jobs and each agent type's default job with its family, and the resolver in
- [2026-11-12 19:41] (comment) ticked: q gates agent prints the capability table jobs (id, family, fallback, use) and each agent type's default job with its family, read from the table and the agent definitions
- [2026-11-12 19:41] (comment) ticked: the printout names the resolver command in the runtime path form; dispatch-job's block uses the same constant
- [2026-11-12 19:42] (comment) ticked: CLAUDE.global.md dispatch checklist says model is the job's table family and names the lookup
- [2026-11-12 19:42] (comment) ticked: tests: known job and family from a fixture table, agent type default job, table change changes printout
- [2026-11-12 19:42] (status) doing → review
