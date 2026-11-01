---
id: KIT-T718
title: Process failure (dirt-empire 2026-10-30): a patch worker retired at the context ceiling with a Handoff block and open work (DE-T208 fw2 land
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T23:59:58Z
updated: 2026-10-31T00:46:13Z
---

## Description
Process failure (dirt-empire 2026-10-30): a patch worker retired at the context ceiling with a Handoff block and open work (DE-T208 fw2 land queued-green, fw3/de2 drafted), and the orchestrator reported 'a fresh agent takes over' without dispatching one; Chris caught it. Nothing flags a ticket whose last agent retired with a Handoff and no successor dispatched. Fix: SubagentStop on a RETIRE/handoff writes a pending-successor row; the Stop hook and orient block/flag until a dispatch cites that ticket.

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-30-a-patch-w
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix e521992: hooks/successor-gate.mjs (Stop, check-id successor) blocks once per distinct set when a done roster row (last 7 days) has a Handoff <id> block in the Notes of a ticket that is not review/done and no later dispatch row cites that ticket (hooks/lib/successor.mjs pendingSuccessors). Evidence: hooks/successor-gate.test.mjs 12 passed (block, once, successor clears, earlier dispatch is no successor, review clears, no handoff, other agent's handoff, in-flight, stale, stop_hook_active, exclusion, wired), agent-context 29, plugin-compat 137. Not built: the orient flag. orient.mjs is 630 lines, over the 600 pre-write block, so any orient edit needs the split first (presented to the maintainer in the report); the Stop gate is the enforcing half.
Orient split (37355ea, by-concern files under hooks/lib/orient, output identical bar timestamps; orient 31, orient-trail 5, agent-roster 47, memory-link 35, doc-tree-gates 19, live-agents 16, model-tag 70 passed) and the orient warning for a retired agent with a Handoff on an open ticket (orient.test.mjs 34 passed, 3 new cases; successor-gate.test.mjs 12 passed). Gate: e521992.
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; gate e521992, orient split 37355ea, orient successor warning b83d356 (orient 34, successor-gate 12 passed); b83d356 was the commit being verified when the publish failed. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: publish the runtime so orient shows the warning.
- Files: hooks/orient.mjs hooks/lib/orient/ hooks/lib/successor.mjs hooks/successor-gate.mjs

## History
- [2026-10-29 23:59] (created) bug — Process failure (dirt-empire 2026-10-30): a patch worker retired at the context ceiling with a Handoff block and open work (DE-T208 fw2 land
- [2026-10-30 23:25] (comment) @kit-agent: claimed by the standing kit agent (this session), starting now; a second writer in the checkout is working overrun.mjs/queue.mjs and landed T719
- [2026-10-30 23:28] (landed) e521992 successor-gate: a Stop blocks once when an agent retired with a Handoff on an open ticket and no later dispatch cites it
- [2026-10-30 23:36] (status) todo → review
- [2026-10-31 00:44] (landed) 37355ea orient: split the 630-line script into by-concern section files under hooks/lib/orient (notices, worktree, agents, recor
- [2026-10-31 00:46] (status) review → review
- [2026-10-31 00:46] (landed) b83d356 orient: a retired agent that left a Handoff block on a ticket still open, with no dispatch since, is listed with its Job
