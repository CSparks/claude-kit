---
id: KIT-T1287
title: checkout-holder gate (KIT-T1114) holds files for an agent killed by a usage limit: agent a6eb592fd35c6d5d3 died mid-edit with no SubagentSto
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T23:44:49Z
updated: 2026-11-16T00:54:47Z
---

## Description
checkout-holder gate (KIT-T1114) holds files for an agent killed by a usage limit: agent a6eb592fd35c6d5d3 died mid-edit with no SubagentStop, its successor (handed the diff with [handoff-waived]) is refused Edit on crates/road-generator/tests/one_road_system/curves.rs; the gate needs a dead-holder release (agent ended / usage-limit death recorded, or a hand-over token in the successor's brief naming the dead agent)

kit-bug-shape: cap:bug:checkout-holder-gate-kit-t1114-holds-files-for-a:81ed6631
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in a289b53 (runtime a289b53, plugin 0.1.55). (1) scripts/claims.mjs, shim bin/claims: claims --release with an agent id (the full id or a prefix of 8 or more characters) and --reason releases every file claim and write hold recorded for that agent (checkout-holder agentEntries then releaseAgent) and appends a killed row with the reason to the roster (updateAgent); refused: a missing reason or id (exit 64), an id that names more than one agent (give the full id), and an agent whose latest write is under 5 minutes old (alive or not dead long enough); an unknown id says nothing is held. Main thread only: hooks/claims-release-gate.mjs (PreToolUse, Bash and PowerShell) refuses a subagent that runs the verb, by claims or node scripts/claims.mjs. The refusals that name a live writer name the verb for the main thread: the delete-rule live-writer text (delete-guidance) and the agent-claims block of an edit (claimMessage with mainThread), and orient AGENT KILLED notice (handback.mjs) now ends with claims --release id --reason why. (2) Signal for an agent that ended in an error: NONE reaches a hook. hooks.json wires SubagentStop (fires only on a normal end, which is why a usage-limit death leaves no row), PostToolUse(Task|TaskStop) and PostToolUseFailure for Bash only; a failed task notification goes to the main thread conversation, not to a hook event, so nothing was guessed or built to release on it. The verb is the sure form until the harness offers one. Tests: hooks/claims-release-verb.test.mjs (a dead agent holds its files and the main thread restore is refused naming the verb; the recently writing agent is refused and keeps its claims; usage errors; a short id names nothing; release by prefix, recorded as killed with the reason; the restore then passes; a second release finds nothing; an ambiguous prefix refused; a subagent refused by the gate, the main thread and other commands pass), mutation-checked (the quiet-period check, the subagent refusal); handback 51 incl. the notice check, agent-claims, claim-release, plugin-compat 160, plugin-drift 14, source-shell-gate-main-restore, discard-live 72, build-write-hold, broken-crates: no FAIL. The bin shim and the new hook entry need /plugin update (0.1.55) and a reload; until then run it as node scripts/claims.mjs from the runtime.

## History
- [2026-11-15 23:44] (created) bug — checkout-holder gate (KIT-T1114) holds files for an agent killed by a usage limit: agent a6eb592fd35c6d5d3 died mid-edit with no SubagentSto
- [2026-11-16 00:54] (landed) a289b53 claims --release lets the main thread free the file claims and write holds of an agent killed without a stop event (impl
- [2026-11-16 00:54] (status) todo → review
