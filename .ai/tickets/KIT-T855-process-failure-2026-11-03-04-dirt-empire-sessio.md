---
id: KIT-T855
title: Process failure 2026-11-03/04 dirt-empire: session idled overnight with queued successors undispatched (DE-T299/T298/T295/T300), 58 inbox it
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-04T16:37:03Z
updated: 2026-11-05T21:54:29Z
---

## Description
Process failure 2026-11-03/04 dirt-empire: session idled overnight with queued successors undispatched (DE-T299/T298/T295/T300), 58 inbox items untriaged, landed work untested, and no UAT receipt or questionnaire handed back. Root cause: nothing blocks Stop/idle when the queue is non-empty and no UAT receipt or AskUserQuestion is pending; the contract rule 'work until interrupted or COMPLETE; stop only to decide/discuss/test' is judgment, not a hook.

kit-bug-shape: cap:bug:process-failure-2026-11-03-04-dirt-empire-sessio
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A held successor brief older than its item's agent retirement is ignored; the newest row wins (hooks/handback-queued.test.mjs)
- [x] The successor gate and the prompt directive name a still-open step at every later stop and prompt, not once per session (successor-gate, handback, dispatch-worker tests)

## Plan
1.

## Notes
Root cause (dirt-empire target/broker/resume-attempts.jsonl + .ai/queued-dispatch.jsonl): (1) successor-gate and handback-directive deduped per session on the set of open steps (block-once), so the first stop of a session was blocked and every later stop and prompt of that session passed silently; DE-T295/T298/T299/T300 showed dispatch-queued from 2026-11-03 18:57 to 2026-11-05 16:03 (27x/19x surfacings counted from orient/prompt/stop) with no further block. (2) applyQueued took the OLDEST held row for a ticket, so rows from 2026-11-03 16:22 (already consumed by later successors that retired with new handoffs) kept presenting 'DISPATCH QUEUED SUCCESSOR NOW' with a stale brief. Fix: hooks/lib/handback-queued.mjs uses only rows queued after the item's agent retired, newest first; hooks/lib/handback.mjs needsAction(); successor-gate.mjs and handback-directive.mjs dedupe only sets that are all queued/unrecoverable; stop_hook_active still allows so a block never loops. Tests: successor-gate 17, handback 36, handback-queued 5 (new), dispatch-worker 30, handoff-close 10, reopened 8, orient 37. Not built: a hook cannot wake a session that has already ended its turn, and a broad 'todo queue / untriaged inbox' Stop gate would block discussion turns; the maintainer should rule on that separately.

## History
- [2026-11-04 16:37] (created) bug — Process failure 2026-11-03/04 dirt-empire: session idled overnight with queued successors undispatched (DE-T299/T298/T295/T300), 58 inbox it
- [2026-11-05 21:54] (comment) criterion added: A held successor brief older than its item's agent retirement is ignored; the newest row wins (hooks/handback-queued.test.mjs)
- [2026-11-05 21:54] (comment) criterion added: The successor gate and the prompt directive name a still-open step at every later stop and prompt, not once per session (successor-gate, handback, dispatch-worker tests)
- [2026-11-05 21:54] (comment) ticked: A held successor brief older than its item's agent retirement is ignored; the newest row wins (hooks/handback-queued.test.mjs)
- [2026-11-05 21:54] (comment) ticked: The successor gate and the prompt directive name a still-open step at every later stop and prompt, not once per session (successor-gate, handback, dispatch-worker tests)
- [2026-11-05 21:54] (status) todo → review
- [2026-11-05 21:54] (landed) c8688aa successor gate and prompt directive re-surface an open step at every stop and prompt; a held brief older than its item's
