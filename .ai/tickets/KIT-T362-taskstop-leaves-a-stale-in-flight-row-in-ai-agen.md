---
id: KIT-T362
title: TaskStop leaves a stale in-flight row in .ai/agents.jsonl: killing an agent with TaskStop fires no SubagentStop, so the roster keeps…
summary:               # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent: KIT-D145
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-10-06T14:51:23.262Z
updated: 2026-11-13T02:38:58Z
---

## Description
TaskStop leaves a stale in-flight row in .ai/agents.jsonl: killing an agent with TaskStop fires no SubagentStop, so the roster keeps showing it as in flight and dispatch-guard blocks the NEXT dispatch in that tree with a phantom conflict. Observed 2026-09-06 in stiletto-2349/rapid-game: agent a99f6e1e91faa2508 was stopped (TaskStop returned success, task-notification reported status killed) and 32 minutes later dispatch-guard still listed it as in flight. ROOT CAUSE: the roster is only closed by the SubagentStop hook, so any termination path that bypasses that hook (TaskStop, and probably a crashed or timed-out agent) never writes a terminal row. FIX SHAPE: close the row on the kill path too - either TaskStop writes a status row itself, or dispatch-guard treats a row with no terminal record and no live task as dead rather than in flight. Workaround used: append a terminal row by hand, which is exactly the kind of manual store surgery the roster exists to avoid.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
2026-10-20 kit agent: readAgents reconciles an in-flight row whose agent died without SubagentStop (reconcileAgents, KIT-T428), so the phantom-conflict cause is addressed on read; I did not re-run the TaskStop reproduction. No hand surgery of agents.jsonl is needed or allowed (store-shell-gate).
2026-11-13 kit agent: reconcile-on-read (KIT-T428) only closes a row once its transcript is idle 30+ min, so a TaskStop'd agent blocked the next writer for that window (observed: road-generator roster, ab78d4c05f512bb66, 23m). Fix 55b8064: PostToolUse(TaskStop) wired to hooks/agent-roster.mjs (hooks.json); recordKill appends a terminal row (status killed, reason taskstop, source taskstop) for the roster row whose id equals tool_input.task_id (or shell_id, or tool_response.task_id) in the session's repo and releases that agent's checkout-holder entry; no matching row (a background shell) or an already terminal row writes nothing; any error fails open. Tests: hooks/task-stop-roster.test.mjs 14 passed (control block, TaskStop of its id frees the next writer, TaskStop of another id keeps the block, malformed payload fails open); agent-roster 48, dispatch-shared-tree 59, dispatch-guard 46, handback 50, handback-queued 5, plugin-compat 152, plugin-drift 14 passed. Runtime published 55b8064. The task-notification status killed is not exposed to any hook event, so it is not wired. Sessions load hook wiring from the plugin cache (installed 0.1.41, repo 0.1.42): the TaskStop matcher reaches a session after the plugin updates to 0.1.42 and the session reloads; agent-roster.mjs itself runs from the runtime now.

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-11-13 02:37] (status) todo → doing
- [2026-11-13 02:37] (landed) 55b8064 agent-roster: PostToolUse(TaskStop) closes the killed agent's roster row (status killed, reason taskstop) and releases i
- [2026-11-13 02:38] (comment) ticked:
- [2026-11-13 02:38] (status) doing → review
