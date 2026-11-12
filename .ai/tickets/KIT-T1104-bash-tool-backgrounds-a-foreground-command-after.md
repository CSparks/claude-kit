---
id: KIT-T1104
title: Bash tool backgrounds a foreground command after 180 s although the wait rule (KIT-T355, KIT-D104) allows one foreground call up to 300 s; a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T19:34:08Z
updated: 2026-11-12T20:19:09Z
---

## Description
Bash tool backgrounds a foreground command after 180 s although the wait rule (KIT-T355, KIT-D104) allows one foreground call up to 300 s; a subagent then has no legal way to wait for a build that needs 4-5 minutes (polling the output file is blocked by wait-poll, sleep is blocked), so it must end with a Handoff or break the rule. Either the harness auto-background threshold should follow the wait-gate ceiling or the rule should name what a subagent does after the auto-background notice.

kit-bug-shape: cap:bug:bash-tool-backgrounds-a-foreground-command-after
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: measured in this checkout, a Bash call with timeout 290000 running a 200 s node timer was moved to the background at 180 s ("moved to the background ... after running for 180s"); the task notification arrived afterwards to the live agent. Sources of the figures: 300 s is KIT-D104 (5-minute ceiling) and KIT-D115 (no Bash timeout over 300000 ms; broker-wait-gate MAX_TOOL_TIMEOUT_MS, docs/wait-rule.md); 120 s is the harness default call timeout (scripts/broker/wait-limits.mjs, KIT-T851); 180 s is the harness cap, in no decision before (KIT-T823 title, scripts/publish-suite.mjs). Chosen: align the kit to the harness, not a new wait primitive (a subagent has no tool that blocks on a task, long-waits blocks sleeps, and SubagentStop ends its shells), and not a weaker gate. Fix 7d46b10: scripts/broker/wait-limits.mjs HARNESS_FOREGROUND_S 180 / MAX_FOREGROUND_WAIT_S 170 is the one constant: waitWindow clamps wait.mjs to it (exit 2 and the running line, never a backgrounded wait), broker-agent-tag defaults to --timeout 170 with a 180000 ms Bash timeout, broker-wait-gate, wait-poll and wait.mjs messages state the 180 s window and the procedure for a call already moved to the background (read its output at most once, never sleep, poll or wait, write the Handoff block and end; main thread reads the one finish notice); docs/wait-rule.md and its 15 verbatim copies plus the work/drain briefs say the same; patch-worker agent and skill say --timeout 170 (also resolves KIT-T950, same root). The no-polling rule is unchanged. Tests: wait-poll 32 (new: two reads of a moved run pass, third and fourth warn, fifth blocks with the 180 s text and Handoff; exit marker frees it; rule text), broker-wait-gate 88 (new: tag gives 170/180 and caps a 280 ask at 180000 ms; block text names 180 s, moved-to-background and --timeout 170; poll loops still blocked), wait-guard 8 (clamp to the harness cap), agent-timeout-rule 115, agent-context 40, broker-wait-release 13, agent 6, wait 3, wait-exit 9. Not changed: scripts/broker/build-run.mjs DEFAULT_MAX_WAIT_S 280 (the build shim queue wait, a separate path) and the 5-minute total ceiling of KIT-D104.
Follow-up 5eb3e77 (reviewed): the 180 s cap in waitWindow applies only to a subagent wait (foreground by rule); a main-thread wait keeps the window it names with --tool-timeout, so a background wait --timeout 900 is not cut; the cut message differs by caller; wait-poll takes its 180 and 170 from wait-limits.mjs. wait-guard 8 PASS (new: main thread 900 s stays 900, subagent cut to 170), wait-poll 32, broker-wait-gate 88, agent-timeout-rule 115, wait 3, wait-exit 9, agent 6 PASS. Fixing shas 7d46b10 and 5eb3e77.

## History
- [2026-11-12 19:34] (created) bug — Bash tool backgrounds a foreground command after 180 s although the wait rule (KIT-T355, KIT-D104) allows one foreground call up to 300 s; a
- [2026-11-12 20:18] (landed) 7d46b10 wait rule: the harness moves any foreground call to the background at 180 s whatever its timeout (measured with a 290 s
- [2026-11-12 20:19] (status) todo → review
- [2026-11-12 20:19] (comment) @claude-kit-agent: (fixed) 7d46b10; wait-poll 32, broker-wait-gate 88, agent-timeout-rule 115, agent-context 40, wait-guard 8 PASS
- [2026-11-12 20:23] (landed) 5eb3e77 wait.mjs: the 180 s harness cap bounds only a subagent wait (always foreground); a main-thread wait keeps the window it 
