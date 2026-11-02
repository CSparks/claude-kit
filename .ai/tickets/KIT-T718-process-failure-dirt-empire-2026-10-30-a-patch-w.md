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
### Handoff ad0b866e39b3b3615
- Jobs: none running. Last publish attempt (npm run publish:runtime at b5787a2) finished RED: control.test.mjs and runner.test.mjs failed in the export (both test bugs, fixed in the commit after b5787a2). Runtime current is 1044337 (published earlier). No background command running.
- State: DONE and pushed: KIT-T821 read-only agents owe no successor (72c619b, ownsWork keeps patch-workers in); KIT-T822 reconciler + ledger + ack + prompt hook (60fd3ca, 2f63f80, published in 1044337). IN CODE, NOT YET PUBLISHED (HEAD after b5787a2): KIT-T823 windowsHide on every publish child (0f59f85); KIT-T824 root cause found: run-file.mjs waited for stdio close, so a test daemon holding stdout inflated recorded times (control.test 317 s recorded vs 17 s real, health.test 476 s vs 27 s) and blocked worker slots; now finishes on process exit with a 500 ms grace plus a 120 s planning cap (b5787a2); the failing files were NOT flaky, they ran in the publish that passed the 180 s harness window; KIT-T825 --require-reached refusal, publish budget 140 s (0f59f85); KIT-T826 sweepScratch at publish start/end and session start, one process scan, stopProcessesUnder fixed for Windows paths (0f59f85, b5787a2); KIT-T827 reconciler never names an unexecutable reopen: resumable() needs the roster outputFile inside the asking session, landed sha on main and recorded in the ticket is auto-acked, else ack/fresh-worker steps (0f59f85); KIT-T828 dispatch refused only for [paths:] overlap is queued in .ai/queued-dispatch.jsonl, gate accepts step queued, step dispatch-queued after the blocker ends (0f59f85). Tests: runtime-publish 31, runner 16 (with the publish env set), housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4 passed. Finding: 16 workers ran the suite in 249 s against 161 s at 8 (workers back to 8). A command past 180 s is moved to the background by the harness and its notification says failed while the process keeps running: wait on the pid (Wait-Process) instead of re-running.
- Next: (1) KIT-T823/T824/T825/T826/T827/T828: run npm run publish:runtime at HEAD in the foreground (the suite at 8 workers needs about 160 s plus export; if it passes 180 s wait on the lock pid in publish.lock, never start a second copy), then set the six tickets to review with the counts above. (2) KIT-T729 270 s rapid-game check note: not started, not read. (3) check-tree dev-dependencies refusal and its duplicate ticket to close: not started; KIT-T829 (broker submit precheck, a test cargo test manifest) was filed by another session and may be the duplicate, not checked. (4) the reconciler non-resumable-reopen gap is KIT-T827, in code; the successor-gate vs paths-overlap deadlock is KIT-T828, in code; both need the publish. (5) Dirt-empire result of the read-only reconciler run: DE-T234 successor for abed59da plus reopen a04ccd85, DE-T245 successor for ae006cdd, DE-T254 successor for afdf94ba, DE-T208 reopen a6aa4f25; the coordinator acked three landed jobs by hand.
- Files: scripts/runtime-publish.mjs scripts/runtime-publish-guard.mjs scripts/run-tests.mjs scripts/test-runner/run-file.mjs scripts/test-runner/select.mjs scripts/test-runner/runner.test.mjs scripts/runtime-publish.test.mjs hooks/lib/handback.mjs hooks/lib/handback-landed.mjs hooks/lib/handback-queued.mjs hooks/lib/queued-dispatch.mjs hooks/dispatch-guard.mjs hooks/dispatch-worker.mjs hooks/housekeeping.mjs hooks/successor-gate.mjs hooks/handback-directive.mjs scripts/broker/control.test.mjs

## History
- [2026-10-29 23:59] (created) bug — Process failure (dirt-empire 2026-10-30): a patch worker retired at the context ceiling with a Handoff block and open work (DE-T208 fw2 land
- [2026-10-30 23:25] (comment) @kit-agent: claimed by the standing kit agent (this session), starting now; a second writer in the checkout is working overrun.mjs/queue.mjs and landed T719
- [2026-10-30 23:28] (landed) e521992 successor-gate: a Stop blocks once when an agent retired with a Handoff on an open ticket and no later dispatch cites it
- [2026-10-30 23:36] (status) todo → review
- [2026-10-31 00:44] (landed) 37355ea orient: split the 630-line script into by-concern section files under hooks/lib/orient (notices, worktree, agents, recor
- [2026-10-31 00:46] (status) review → review
- [2026-10-31 00:46] (landed) b83d356 orient: a retired agent that left a Handoff block on a ticket still open, with no dispatch since, is listed with its Job
- [2026-11-02 16:57] (landed) 67f94f6 KIT-T718 Notes: Handoff ad0b866e39b3b3615 (publish fixes T823-T828 in code, publish pending) [no-test: ticket store only
- [2026-11-02 16:58] (landed) 6b1d621 KIT-T718 Notes: Handoff ad0b866e39b3b3615 detail [no-test: ticket store only] (implements KIT-T718)
