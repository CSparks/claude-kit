---
id: KIT-T999
title: agent definition (implementation agent, KIT-T355 section) tells agents to run long builds 'with the max timeout' (600000 ms) while broker-wa
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D104]
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:40:47Z
updated: 2026-11-11T05:59:17Z
---

## Description
agent definition (implementation agent, KIT-T355 section) tells agents to run long builds 'with the max timeout' (600000 ms) while broker-wait-gate blocks any Bash timeout past 5 min (KIT-D104); prevention: rewrite that line to 'timeout <= 290000 ms'

kit-bug-shape: cap:bug:agent-definition-implementation-agent-kit-t355-s
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] no agent definition, docs/wait-rule.md, work/drain brief or wait-poll message advises the max timeout; rule is timeout <= 300000 ms, else scope down or split
- [x] hooks/agent-timeout-rule.test.mjs fails when any of them names a timeout above 300000 ms

## Plan
1.

## Notes
Fixed 5bb4e05: single source docs/wait-rule.md carried verbatim in 15 agent definitions (visual-reviewer twice) plus commands/work.md, commands/drain.md and the hooks/wait-poll.mjs block message. Test: hooks/agent-timeout-rule.test.mjs 59 passed; wait-poll 28 passed; broker-wait-gate 70 passed; full suite exit 0 (240 files). KIT-T1021 is the same defect in the brief template, covered by the same commit.

## History
- [2026-11-11 03:40] (created) bug — agent definition (implementation agent, KIT-T355 section) tells agents to run long builds 'with the max timeout' (600000 ms) while broker-wa
- [2026-11-11 05:51] (comment) criterion added: no agent definition, docs/wait-rule.md, work/drain brief or wait-poll message advises the max timeout; rule is timeout <= 300000 ms, else scope down or split
- [2026-11-11 05:51] (comment) criterion added: hooks/agent-timeout-rule.test.mjs fails when any of them names a timeout above 300000 ms
- [2026-11-11 05:51] (status) todo → doing
- [2026-11-11 05:51] (comment) @implementer: Covers KIT-T1021 (dispatch brief template) too: commands/work.md and commands/drain.md carry the same fix.
- [2026-11-11 05:51] (comment) ticked: no agent definition, docs/wait-rule.md, work/drain brief or wait-poll message advises the max timeout; rule is timeout <= 300000 ms, else scope down or split
- [2026-11-11 05:51] (comment) ticked: hooks/agent-timeout-rule.test.mjs fails when any of them names a timeout above 300000 ms
- [2026-11-11 05:55] (landed) 5bb4e05 fix: agent definitions, work/drain briefs and the wait-poll message no longer advise the max Bash timeout: rule is a tim
- [2026-11-11 05:59] (status) doing → review
