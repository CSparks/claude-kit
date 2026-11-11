---
id: KIT-T837
title: successor gate keeps naming a retired worker's handoff after the orchestrator reopened that worker with SendMessage naming the ticket (dirt-empire 2026-11-02, 5+ times: a39efbdfcc9ab317f DE-T278, ab469c920a2a9e28f DE-T245)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T19:27:14Z
updated: 2026-11-02T19:28:19Z
---

## Description
A SendMessage that resumes the agent that wrote the handoff and names its ticket must count as taking the handoff over until the agent retires again; only a reopened agent silent past 30 min comes back as a failed step. Closing as nothing-owed and a duplicate successor are both wrong here.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T718, KIT-T822, KIT-T827, KIT-T830
Fix: hooks/resume-check.mjs records each SendMessage that names tickets (hooks/lib/reopened.mjs, .ai/reopened.jsonl); handback.mjs workItems skips a handoff whose agent was reopened for that ticket after its retirement while the agent output is growing, and raises kind 'reopened' (REOPENED, SILENT) after 30 min without output; a later retirement restores the normal rule. Tests: hooks/reopened.test.mjs 8 passed (real resume-check hook; negatives: other agent, no ticket named, other ticket; silent after timeout; growing output not silent; re-retired agent blocks again), successor-gate 16, handback 36, handoff-close 10.

## History
- [2026-11-02 19:27] (created) bug — successor gate keeps naming a retired worker's handoff after the orchestrator reopened that worker with SendMessage naming the ticket (dirt-empire 2026-11-02, 5+ times: a39efbdfcc9ab317f DE-T278, ab469c920a2a9e28f DE-T245)
- [2026-11-02 19:28] (status) todo → review
- [2026-11-02 19:28] (landed) 0ab34ce A SendMessage resume naming the ticket takes the retired worker's handoff over until it retires again or stays silent 30
- [2026-11-02 20:03] (landed) d5524a4 Ticket sync after runtime e769a0a [no-test: ticket store only] (implements KIT-T834, KIT-T837, KIT-T838, KIT-T840)
